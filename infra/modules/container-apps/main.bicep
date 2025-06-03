@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('Abbreviations for resources')
param abbrs object

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceResourceId string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('API identity resource ID and client ID')
param apiIdentityId string
param apiIdentityClientId string

@description('Extractors identity resource ID and client ID')
param extractorsIdentityId string
param extractorsIdentityClientId string

@description('UI identity resource ID and client ID')
param uiIdentityId string
param uiIdentityClientId string

@description('Videos identity resource ID and client ID')
param videosIdentityId string
param videosIdentityClientId string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Whether the container apps already exist')
param apiExists bool
param imageExtractorExists bool
param scriptExtractorExists bool
param uiExists bool
param videoGeneratorExists bool
param videoTransformationExists bool
param videoConcatenatorExists bool

@description('Environment variables for all container apps')
param commonEnvVariables array = []

// Create the Container Apps environment
module containerAppsEnv 'environment.bicep' = {
  name: 'container-apps-environment'
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    abbrs: abbrs
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceResourceId
  }
}

// Create the API container app
module apiApp './api.bicep' = {
  name: 'api-container-app'
  params: {
    location: location
    tags: tags
    environmentId: containerAppsEnv.outputs.environmentId
    defaultDomain: containerAppsEnv.outputs.defaultDomain
    containerRegistryLoginServer: containerRegistryLoginServer
    apiIdentityId: apiIdentityId
    apiIdentityClientId: apiIdentityClientId
    applicationInsightsConnectionString: applicationInsightsConnectionString
    apiExists: apiExists
    commonEnvVariables: commonEnvVariables
  }
}

// Create the extractor container apps
module extractorApps 'extractors.bicep' = {
  name: 'extractor-container-apps'
  params: {
    location: location
    tags: tags
    environmentId: containerAppsEnv.outputs.environmentId
    containerRegistryLoginServer: containerRegistryLoginServer
    extractorsIdentityId: extractorsIdentityId
    extractorsIdentityClientId: extractorsIdentityClientId
    applicationInsightsConnectionString: applicationInsightsConnectionString
    imageExtractorExists: imageExtractorExists
    scriptExtractorExists: scriptExtractorExists
    commonEnvVariables: commonEnvVariables
  }
}

// Create the UI container app
module uiApp 'ui.bicep' = {
  name: 'ui-container-app'
  params: {
    location: location
    tags: tags
    environmentId: containerAppsEnv.outputs.environmentId
    defaultDomain: containerAppsEnv.outputs.defaultDomain
    containerAppsEnvironmentName: containerAppsEnv.outputs.environmentName
    containerRegistryLoginServer: containerRegistryLoginServer
    uiIdentityId: uiIdentityId
    uiIdentityClientId: uiIdentityClientId
    applicationInsightsConnectionString: applicationInsightsConnectionString
    uiExists: uiExists
    commonEnvVariables: commonEnvVariables
  }
}

module videosApp 'videos.bicep' = {
  name: 'videos-container-app'
  params: {
    location: location
    tags: tags
    environmentId: containerAppsEnv.outputs.environmentId
    containerRegistryLoginServer: containerRegistryLoginServer
    videosIdentityId: videosIdentityId
    videosIdentityClientId: videosIdentityClientId
    applicationInsightsConnectionString: applicationInsightsConnectionString
    videoGeneratorExists: videoGeneratorExists
    videoTransformationExists: videoTransformationExists
    videoConcatenatorExists: videoConcatenatorExists
    commonEnvVariables: commonEnvVariables
  }
}

// Outputs for the entire container apps deployment
output environmentId string = containerAppsEnv.outputs.environmentId
output defaultDomain string = containerAppsEnv.outputs.defaultDomain

output apiResourceId string = apiApp.outputs.resourceId
output apiFqdn string = apiApp.outputs.fqdn
output apiName string = apiApp.outputs.name

output imageExtractorResourceId string = extractorApps.outputs.imageExtractorResourceId
output imageExtractorName string = extractorApps.outputs.imageExtractorName
output scriptExtractorResourceId string = extractorApps.outputs.scriptExtractorResourceId
output scriptExtractorName string = extractorApps.outputs.scriptExtractorName

output uiResourceId string = uiApp.outputs.resourceId
output uiFqdn string = uiApp.outputs.fqdn
output uiName string = uiApp.outputs.name
