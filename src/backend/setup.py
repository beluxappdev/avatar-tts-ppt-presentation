from setuptools import setup, find_packages # type: ignore

setup(
    name="common",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "pydantic==2.11.5",
        "pydantic-settings==2.9.1",
        "azure-storage-blob==12.25.1",
        "azure-servicebus==7.14.2",
        "azure-cosmos==4.9.0",
        "azure-identity==1.21.0",
        "azure-core==1.34.0",
        "python-dotenv==1.1.0",
        "aiofiles==24.1.0",
        "aiohttp ==3.11.18",
        "pdf2image==1.17.0",
        "Pillow==11.2.1",
        "python-pptx==1.0.2"
    ],
    python_requires=">=3.8",
)