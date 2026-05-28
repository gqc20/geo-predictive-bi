import logging
import os
import sys

def get_logger(name: str) -> logging.Logger:
    """Configuración centralizada de logging para todo el proyecto."""
    logger = logging.getLogger(name)
    
    # Si el logger ya tiene handlers, no añadimos más
    if logger.hasHandlers():
        return logger

    logger.setLevel(logging.INFO)
    
    # Formato consistente
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Handler de Consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Handler de Archivo
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'execution.log')
    
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger
