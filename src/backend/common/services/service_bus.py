import json
import asyncio
from typing import Dict, Any, Callable, Union
import logging
from azure.servicebus.aio import ServiceBusClient # type: ignore
from azure.servicebus import ServiceBusMessage, ServiceBusReceivedMessage, ServiceBusReceiveMode # type: ignore
from azure.identity.aio import DefaultAzureCredential # type: ignore
from azure.core.exceptions import AzureError # type: ignore

logger = logging.getLogger(__name__)


class ServiceBusService:
    def __init__(self, fully_qualified_namespace: str):
        self.credential = DefaultAzureCredential()
        self.fully_qualified_namespace = fully_qualified_namespace
        self.servicebus_client = None
        self._is_listening = False
    
    async def _get_client(self):
        """Get or create the async ServiceBus client"""
        if self.servicebus_client is None:
            self.servicebus_client = ServiceBusClient(
                fully_qualified_namespace=self.fully_qualified_namespace,
                credential=self.credential
            )
        return self.servicebus_client
    
    async def send_message(self, destination_type: str, destination_name: str, message_data: Dict[str, Any]) -> None:
        """Send message to a Service Bus topic or queue

        Args:
            destination_type (str): Type of destination - 'topic' or 'queue'
            destination_name (str): The name of the Service Bus topic or queue to send the message to.
            messages_data (Dict[str, Any]): The message data to be sent, typically a dictionary containing the message content. 
        """
        sender = None
        try:
            # Get the async client
            client = await self._get_client()
            
            if destination_type == "topic":
                # Get the topic sender
                sender = client.get_topic_sender(topic_name=destination_name)
            elif destination_type == "queue":
                # Get the queue sender
                sender = client.get_queue_sender(queue_name=destination_name)
            else:
                raise ValueError("Invalid destination type. Must be 'topic' or 'queue'.")
            
            # Convert message data to JSON string
            message_body = json.dumps(message_data, default=str)  # Added default=str for datetime serialization
            
            # Create ServiceBus message
            message = ServiceBusMessage(message_body)
            
            # Send the message
            await sender.send_messages(message)
            
            logger.info(f"Message sent successfully to destination '{destination_name}' of type '{destination_type}'")
            
        except AzureError as e:
            logger.error(f"Azure error sending message to Service Bus: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending message to Service Bus: {e}")
            raise
        finally:
            if sender:
                await sender.close()

    async def _listen_to_messages(
        self,
        receiver_factory: Callable,
        receiver_name: str,
        message_handler: Callable[[ServiceBusReceivedMessage], Any],
        max_message_count: int = 1,
        retry_delay: int = 5,
        use_lock_renewer: bool = False
    ) -> None:
        """Generic method to listen to messages from any Service Bus receiver
        
        Args:
            receiver_factory: Function that creates and returns a receiver
            receiver_name: Name for logging purposes (e.g., "queue 'myqueue'" or "topic 'mytopic', subscription 'mysub'")
            message_handler: Async function to handle received messages
            max_message_count: Maximum number of messages to receive at once
            retry_delay: Delay between retries when errors occur (seconds)
        """
        self._is_listening = True
        receiver = None
        
        try:
            receiver = receiver_factory()
            logger.info(f"Starting to listen for messages on {receiver_name}")
            
            async with receiver:
                while self._is_listening:
                    try:
                        # Receive messages in batches
                        received_msgs = await receiver.receive_messages(
                            max_message_count=max_message_count,
                            max_wait_time=5
                        )
                        
                        for msg in received_msgs:
                            try:
                                if use_lock_renewer:
                                    # Run message processing and lock renewal concurrently
                                    lock_renewal_task = asyncio.create_task(
                                        self._renew_message_lock_periodically(receiver, msg)
                                    )
                                    
                                    # Create message handler task
                                    handler_task = asyncio.create_task(message_handler(msg))
                                    
                                    try:
                                        # Wait for message handler to complete
                                        await handler_task
                                        logger.info("Message processed successfully")
                                    finally:
                                        # Always cancel lock renewal when message processing is done
                                        lock_renewal_task.cancel()
                                        try:
                                            await lock_renewal_task
                                        except asyncio.CancelledError:
                                            pass  # Expected when we cancel the task
                                else:
                                    # No lock renewal needed, just process the message
                                    await message_handler(msg)
                                    logger.info("Message processed successfully")

                                await receiver.complete_message(msg)
                                
                            except Exception as e:
                                logger.error(f"Error processing message: {str(e)}")
                                await receiver.abandon_message(msg)
                                
                    except Exception as e:
                        if self._is_listening:  # Only log if we're still supposed to be listening
                            logger.error(f"Error receiving messages: {str(e)}")
                            await asyncio.sleep(retry_delay)  # Wait before retrying
                            
        except Exception as e:
            logger.error(f"Fatal error in message processing for {receiver_name}: {str(e)}")
            raise
        finally:
            if receiver:
                await receiver.close()
            logger.info(f"Stopped listening for messages on {receiver_name}")
    
    async def listen_to_subscription(
        self,
        topic_name: str,
        subscription_name: str,
        message_handler: Callable[[ServiceBusReceivedMessage], Any],
        max_wait_time: int = 60,
        max_message_count: int = 1,
        retry_delay: int = 5,
        use_lock_renewer: bool = False,
        use_delete_receiver: bool = False
    ) -> None:
        """Listen to messages from a Service Bus subscription
        
        Args:
            topic_name: The name of the Service Bus topic
            subscription_name: The name of the subscription
            message_handler: Async function to handle received messages
            max_wait_time: Maximum time to wait for messages (seconds)
            max_message_count: Maximum number of messages to receive at once
            retry_delay: Delay between retries when errors occur (seconds)
        """
        client = await self._get_client()
        receive_mode = ServiceBusReceiveMode.RECEIVE_AND_DELETE if use_delete_receiver else ServiceBusReceiveMode.PEEK_LOCK
        def create_receiver():
            return client.get_subscription_receiver(
                topic_name=topic_name,
                receive_mode=receive_mode,
                subscription_name=subscription_name,
                max_wait_time=max_wait_time
            )
        
        receiver_name = f"topic '{topic_name}', subscription '{subscription_name}'"
        await self._listen_to_messages(create_receiver, receiver_name, message_handler, max_message_count, retry_delay, use_lock_renewer)

    async def listen_to_queue(
        self,
        queue_name: str,
        message_handler: Callable[[ServiceBusReceivedMessage], Any],
        max_wait_time: int = 60,
        max_message_count: int = 1,
        retry_delay: int = 5,
        use_lock_renewer: bool = False,
        use_delete_receiver: bool = False
    ) -> None:
        """Listen to messages from a Service Bus queue
        
        Args:
            queue_name: The name of the Service Bus queue
            message_handler: Async function to handle received messages
            max_wait_time: Maximum time to wait for messages (seconds)
            max_message_count: Maximum number of messages to receive at once
            retry_delay: Delay between retries when errors occur (seconds)
        """
        client = await self._get_client()
        receive_mode = ServiceBusReceiveMode.RECEIVE_AND_DELETE if use_delete_receiver else ServiceBusReceiveMode.PEEK_LOCK
        def create_receiver():
            return client.get_queue_receiver(
                queue_name=queue_name,
                receive_mode=receive_mode,
                max_wait_time=max_wait_time
            )
        
        receiver_name = f"queue '{queue_name}'"
        await self._listen_to_messages(create_receiver, receiver_name, message_handler, max_message_count, retry_delay, use_lock_renewer)

    async def _renew_message_lock_periodically(self, receiver, message):
        """Periodically renew message lock during long processing"""
        try:
            while True:
                try:
                    await receiver.renew_message_lock(message)
                    logger.info(f"Message lock renewed successfully")
                except Exception as e:
                    error_message = str(e).lower()
                    # Stop trying to renew if message has been settled or deleted
                    if "deleted" in error_message or "settled" in error_message or "expired" in error_message:
                        logger.info(f"Message has been settled, deleted or expired, stopping lock renewal: {e}")
                        break
                    else:
                        logger.warning(f"Failed to renew message lock: {e}")
                        # Continue trying for other types of errors
                finally:
                    # Wait before renewing again
                    await asyncio.sleep(20)
        except asyncio.CancelledError:
            logger.info("Lock renewal task cancelled")
            pass

    def stop_listening(self):
        """Stop listening for messages"""
        self._is_listening = False
        logger.info("Stopping message listener...")
    
    async def close(self):
        """Close the ServiceBus client"""
        self.stop_listening()
        if self.servicebus_client:
            await self.servicebus_client.close()