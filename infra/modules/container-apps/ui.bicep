@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Container Apps environment resource ID')
param environmentId string

@description('Container Apps environment default domain')
param defaultDomain string

@description('Container Apps environment name')
param containerAppsEnvironmentName string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('User-assigned identity resource ID for the UI')
param uiIdentityId string

@description('User-assigned identity client ID for the UI')
param uiIdentityClientId string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Whether the UI container app already exists')
param uiExists bool

@description('Environment variables for all container apps')
param commonEnvVariables array = []

// Fetch the latest image for the UI
module uiFetchLatestImage './fetch-container-image.bicep' = {
  name: 'ui-fetch-image'
  params: {
    exists: uiExists
    name: 'ui'
  }
}

// Create the UI container app
module ui 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'ui'
  params: {
    name: 'ui'
    ingressTargetPort: 80
    scaleMinReplicas: 1
    scaleMaxReplicas: 10
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: uiFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
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
            value: uiIdentityClientId
          }
          {
            name: 'API_INTERNAL_URL'
            value: 'http://api.${containerAppsEnvironmentName}.internal:80'
          }
          {
            name: 'PORT'
            value: '80'
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [uiIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: uiIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'ui' })
  }
}

// Outputs for use in other modules
output resourceId string = ui.outputs.resourceId
output fqdn string = ui.outputs.fqdn
output name string = ui.outputs.name
