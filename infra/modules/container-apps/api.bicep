@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Container Apps environment resource ID')
param environmentId string

@description('Container Apps environment default domain')
param defaultDomain string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('User-assigned identity resource ID for the API')
param apiIdentityId string

@description('User-assigned identity client ID for the API')
param apiIdentityClientId string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Whether the API container app already exists')
param apiExists bool

@description('Environment variables for all container apps')
param commonEnvVariables array = []

// Fetch the latest image for the API
module apiFetchLatestImage './fetch-container-image.bicep' = {
  name: 'api-fetch-image'
  params: {
    exists: apiExists
    name: 'api'
  }
}

// Create the API container app
module api 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'api'
  params: {
    name: 'api'
    ingressExternal: true
    ingressTargetPort: 3100
    scaleMinReplicas: 10
    scaleMaxReplicas: 20
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: apiFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
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
            value: apiIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: apiIdentityClientId
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [apiIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: apiIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'api' })
  }
}

// Outputs for use in other modules
output resourceId string = api.outputs.resourceId
output fqdn string = api.outputs.fqdn
output name string = api.outputs.name
