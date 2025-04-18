# avatar-tts-ppt-presentation

This repository contains a microservices-based application designed to generate PowerPoint presentations using text-to-speech and avatars. Currently, the project includes an API microservice built with .NET located in `src/api`.

## Prerequisites

Before running the application, ensure you have the following:

- Docker installed
- An active Azure subscription
- Azure Blob Storage Account with a container
- Azure Cosmos DB with a database and a container configured with `/userId` as the partition key
- Azure Service Bus with a topic
- A Service Principal with the following roles:
  - **Cosmos DB Built-in Data Contributor** (scope: Cosmos DB account)
    - If you cannot find this role in the Azure portal, assign it using Azure CLI:
      ```bash
      az cosmosdb sql role assignment create \
        --account-name "<your-cosmosdb-database-name>" \
        --resource-group "<your-cosmosdb-resource-group>" \
        --scope "/" \
        --principal-id "<your-sp-object-id>" \
        --role-definition-name "Cosmos DB Built-in Data Contributor"
      ```
  - **Storage Blob Data Contributor** (scope: Blob Storage account)
  - **Azure Service Bus Data Sender** (scope: Service Bus namespace)

## Setup

1. Copy the provided `env_template` file to a new file named `.env` and fill in your Azure configuration details.

```bash
cp env_template .env
```

2. Populate the `.env` file with your Azure credentials and resource details.

## Running the Application

Once your `.env` file is configured, run the following command to build and start the application:

```bash
docker compose up --build
```

Currently, this will start the `ppt-api` service. Additional microservices will be added in the future.