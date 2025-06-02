import logging
import sys


def setup_logging(service_name: str, log_level: str = "INFO"):
    """Setup logging configuration for services"""
    
    # Configure root logger to catch all logs
    root_logger = logging.getLogger()
    
    # Check if root logger is already configured to prevent duplicates
    if root_logger.handlers:
        # Clear existing handlers to avoid duplicates
        root_logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Setup root logger to catch all logs
    root_logger.setLevel(getattr(logging, log_level.upper()))
    root_logger.addHandler(console_handler)
    
    # Also setup the specific service logger
    service_logger = logging.getLogger(service_name)
    service_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Set Azure SDK loggers to WARNING to reduce noise (optional)
    logging.getLogger('azure').setLevel(logging.WARNING)
    logging.getLogger('azure.core').setLevel(logging.WARNING)
    logging.getLogger('azure.servicebus').setLevel(logging.INFO)  # Keep servicebus logs
    
    return service_logger