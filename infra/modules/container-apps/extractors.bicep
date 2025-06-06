@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Container Apps environment resource ID')
param environmentId string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('User-assigned identity resource ID for the extractors')
param extractorsIdentityId string

@description('User-assigned identity client ID for the extractors')
param extractorsIdentityClientId string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Whether the image extractor container app already exists')
param imageExtractorExists bool

@description('Whether the script extractor container app already exists')
param scriptExtractorExists bool

@description('Environment variables for all container apps')
param commonEnvVariables array = []

// Fetch the latest image for the image extractor
module imageExtractorFetchLatestImage './fetch-container-image.bicep' = {
  name: 'extractor-fetch-image'
  params: {
    exists: imageExtractorExists
    name: 'image-extractor'
  }
}

// Fetch the latest image for the script extractor
module scriptExtractorFetchLatestImage './fetch-container-image.bicep' = {
  name: 'extractor-fetch-script'
  params: {
    exists: scriptExtractorExists
    name: 'script-extractor'
  }
}

// Create the image extractor container app
module imageExtractor 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'image-extractor'
  params: {
    name: 'image-extractor'
    disableIngress: true
    scaleMinReplicas: 20
    scaleMaxReplicas: 30
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: imageExtractorFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('2')
          memory: '4.0Gi'
        }
        env: concat([
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: extractorsIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: extractorsIdentityClientId
          }
          {
            name: 'EXTRACTOR_TYPE'
            value: 'image_extractor'
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [extractorsIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: extractorsIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'image-extractor' })
  }
}

// Create the script extractor container app
module scriptExtractor 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'script-extractor'
  params: {
    name: 'script-extractor'
    disableIngress: true
    scaleMinReplicas: 10
    scaleMaxReplicas: 20
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: scriptExtractorFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: concat([
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: extractorsIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: extractorsIdentityClientId
          }
          {
            name: 'EXTRACTOR_TYPE'
            value: 'script_extractor'
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [extractorsIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: extractorsIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'script-extractor' })
  }
}

// Outputs for use in other modules
output imageExtractorResourceId string = imageExtractor.outputs.resourceId
output imageExtractorName string = imageExtractor.outputs.name
output scriptExtractorResourceId string = scriptExtractor.outputs.resourceId
output scriptExtractorName string = scriptExtractor.outputs.name
