import asyncio
import sys
import json
import signal
from abc import ABC, abstractmethod
from typing import Dict, Any
from azure.servicebus import ServiceBusReceivedMessage # type: ignore

from .service_bus import ServiceBusService
from ..models.service_config import ServiceBusConfig, QueueConfig, SubscriptionConfig
from ..utils.config import Settings
from ..utils.logging import setup_logging


class BaseService(ABC):
    """Unified base class for all services that combines lifecycle management and message handling"""
    
    def __init__(self, settings: Settings, service_name: str, service_bus_config: ServiceBusConfig):
        """Initialize the base service
        
        Args:
            settings: Application settings
            service_name: Name of the service for logging
            service_bus_config: Configuration for the Service Bus source (queue or subscription)
        """
        self.settings = settings
        self.service_name = service_name
        self.service_bus_config = service_bus_config
        
        # Setup logging
        self.logger = setup_logging(f"{service_name.lower().replace(' ', '_')}_main")
        
        # Initialize Service Bus
        self.service_bus = ServiceBusService(settings.service_bus_fqdn)
        
        # Service runner state
        self.service_instance = None
        self._is_running = False
    
    async def run(self):
        """Run the service with full lifecycle management (replaces ServiceRunner.run)"""
        try:
            # Setup signal handlers for graceful shutdown
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            
            self.logger.info(f"Starting {self.service_name}")
            self.logger.info(str(self.service_bus_config))
            
            # Initialize service-specific resources
            await self._initialize()
            
            # Start processing messages
            await self._start_message_processing()
            
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt")
        except Exception as e:
            self.logger.error(f"Fatal error in {self.service_name}: {str(e)}")
            raise
        finally:
            await self._cleanup()
    
    async def _start_message_processing(self):
        """Start processing messages from Service Bus queue or subscription"""
        self._is_running = True
        
        try:
            if isinstance(self.service_bus_config, QueueConfig):
                await self.service_bus.listen_to_queue(
                    queue_name=self.service_bus_config.queue_name,
                    message_handler=self._handle_message_wrapper,
                    max_wait_time=self.service_bus_config.max_wait_time,
                    max_message_count=self.service_bus_config.max_message_count,
                    retry_delay=self.service_bus_config.retry_delay,
                    use_lock_renewer=self.service_bus_config.use_lock_renewer,
                    use_delete_receiver=self.service_bus_config.use_delete_receiver
                )
            elif isinstance(self.service_bus_config, SubscriptionConfig):
                await self.service_bus.listen_to_subscription(
                    topic_name=self.service_bus_config.topic_name,
                    subscription_name=self.service_bus_config.subscription_name,
                    message_handler=self._handle_message_wrapper,
                    max_wait_time=self.service_bus_config.max_wait_time,
                    max_message_count=self.service_bus_config.max_message_count,
                    retry_delay=self.service_bus_config.retry_delay,
                    use_lock_renewer=self.service_bus_config.use_lock_renewer,
                    use_delete_receiver=self.service_bus_config.use_delete_receiver
                )
        except Exception as e:
            self.logger.error(f"Fatal error in message processing: {str(e)}")
            raise
    
    async def _handle_message_wrapper(self, message: ServiceBusReceivedMessage):
        """Wrapper for message handling with common error handling and parsing"""
        try:
            # Parse message body
            message_body = str(message)
            message_data = json.loads(message_body)
            
            self.logger.info(f"Processing message: {message_data}")
            
            # Call the service-specific message handler
            await self.handle_message(message_data)
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse message as JSON: {str(e)}")
            raise
        except Exception as e:
            self.logger.error(f"Error processing message: {str(e)}")
            raise
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}")
        asyncio.create_task(self._shutdown_handler())
        sys.exit(0)
    
    async def _shutdown_handler(self):
        """Handle graceful shutdown"""
        self.logger.info("Shutdown signal received, cleaning up...")
        self._is_running = False
        await self._cleanup()
        self.logger.info("Shutdown complete")
    
    def stop_processing(self):
        """Stop processing messages"""
        self.logger.info(f"Stopping {self.service_name}")
        self._is_running = False
        self.service_bus.stop_listening()
    
    @abstractmethod
    async def _initialize(self) -> None:
        """Initialize service-specific resources - implemented by subclasses"""
        pass
    
    @abstractmethod
    async def handle_message(self, message_data: Dict[str, Any]) -> None:
        """Handle incoming Service Bus message - implemented by subclasses
        
        Args:
            message_data: Parsed message data as dictionary
        """
        pass
    
    async def _cleanup(self):
        """Cleanup base resources and call service-specific cleanup"""
        self.logger.info("Cleaning up base service resources")
        try:
            await self.cleanup()
            if self.service_bus:
                await self.service_bus.close()
        except Exception as e:
            self.logger.error(f"Error during cleanup: {str(e)}")
    
    async def cleanup(self):
        """Service-specific cleanup - can be overridden by subclasses"""
        pass

def run_service(service_instance):
    """Convenience function to run a service instance"""
    asyncio.run(service_instance.run())