# avatar-tts-ppt-presentation

## Running the application locally

### Prerequisites
- Install [Docker](https://docs.docker.com/get-docker/)
- Have an active [Azure subscription](https://azure.microsoft.com/)
- Deploy an [Azure Speech Service](https://azure.microsoft.com/services/cognitive-services/speech-services/) resource
- Deploy an [Azure Storage](https://azure.microsoft.com/services/storage/) resource

### Setup
1. Copy the environment template file:
```bash
cp env_template .env
```

2. Fill in the required values in the `.env` file:
```
SPEECH_ENDPOINT=<your-speech-service-endpoint>
SPEECH_KEY=<your-speech-service-key>
AZURE_STORAGE_CONNECTION_STRING=<your-storage-connection-string>
AZURE_STORAGE_CONTAINER=slides
```

### Run the application
Execute the following command to build and run the application:
```bash
docker compose up --build
```


