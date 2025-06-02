targetScope = 'subscription'

// ██████   █████  ██████   █████  ███    ███ ███████ ████████ ███████ ██████  ███████ 
// ██   ██ ██   ██ ██   ██ ██   ██ ████  ████ ██         ██    ██      ██   ██ ██      
// ██████  ███████ ██████  ███████ ██ ████ ██ █████      ██    █████   ██████  ███████ 
// ██      ██   ██ ██   ██ ██   ██ ██  ██  ██ ██         ██    ██      ██   ██      ██ 
// ██      ██   ██ ██   ██ ██   ██ ██      ██ ███████    ██    ███████ ██   ██ ███████ 

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Whether the API container app already exists')
param apiExists bool

@description('Whether the image extractor container app already exists')
param imageExtractorExists bool

@description('Whether the script extractor container app already exists')
param scriptExtractorExists bool

@description('Whether the UI container app already exists')
param uiExists bool

@description('Whether the video generator container app already exists')
param videoGeneratorExists bool

@description('Whether the video transformation container app already exists')
param videoTransformationExists bool

@description('Whether the video concatenator container app already exists')
param videoConcatenatorExists bool

@description('The resource ID of the Speech Service')
param speechServiceResourceId string

@description('Tags that will be applied to all resources')
param tags object = {
  'azd-env-name': environmentName
  SecurityControl: 'Ignore'
}

/* ------------------------ User Assigned Identities ------------------------ */

@description('API user-assigned identity name')
param userAssignedIdentityApiName string = 'umidapi'

@description('Extractors user-assigned identity name')
param userAssignedIdentityExtractorsName string = 'umidextractors'

@description('UI user-assigned identity name')
param userAssignedIdentityUiName string = 'umidui'

@description('Video user-assigned identity name')
param userAssignedIdentityVideosName string = 'umidvideos'

/* ----------------------------- Storage Account ---------------------------- */

@description('The storage account name')
param storageAccountName string = 'stavatartts'

@description('The storage account SKU name')
param storageAccountSkuName string = 'Standard_LRS'

@description('The name of the container that stores the PowerPoints in the storage account')
param storageAccountPptsContainerName string = 'ppts'

/* -------------------------------- Cosmos DB ------------------------------- */

@description('The name of the cosmos DB account')
param cosmosDbAccountName string = 'cosnoavatartts'

@description('The name of the cosmos DB database')
param cosmosDbDatabaseName string = 'avatar-tts'

@description('The name of the powerpoint cosmos DB container')
param cosmosDbPptContainerName string = 'ppts'

@description('The name of the script cosmos DB container')
param cosmosDbUserContainerName string = 'users'

/* ------------------------------- Service Bus ------------------------------ */

@description('The name of the service bus namespace')
param serviceBusNamespaceName string = 'sbavatartts'

@description('The name of the service bus topic')
param serviceBusTopicName string = 'ppt-uploaded'

@description('The name of the subscription for the image extractor')
param serviceBusSubscriptionNameImage string = 'image-extractor'

@description('The name of the subscription for the script extractor')
param serviceBusSubscriptionNameScript string = 'script-extractor'

@description('The name of the service bus queue for the video generator')
param serviceBusQueueVideoGeneratorName string = 'video-generator'

@description('The name of the service bus queue for the video transformation')
param serviceBusQueueVideoTransformationName string = 'video-transformation'

@description('The name of the service bus queue for the video concatenator')
param serviceBusQueueVideoConcatenatorName string = 'video-concatenator'

// ██    ██  █████  ██████  ██  █████  ██████  ██      ███████ ███████ 
// ██    ██ ██   ██ ██   ██ ██ ██   ██ ██   ██ ██      ██      ██      
// ██    ██ ███████ ██████  ██ ███████ ██████  ██      █████   ███████ 
//  ██  ██  ██   ██ ██   ██ ██ ██   ██ ██   ██ ██      ██           ██ 
//   ████   ██   ██ ██   ██ ██ ██   ██ ██████  ███████ ███████ ███████ 

var resourceToken = uniqueString(subscription().id, rg.id, location)

// Load abbreviations from JSON file
var abbrs = loadJsonContent('./abbreviations.json')

var speechServiceResourceGroupName = split(speechServiceResourceId, '/')[4]

// Common environment variables for container apps
var env_variables = [
  {
    name: 'ENVIRONMENT'
    value: 'Azure'
  }
  {
    name: 'AzureServices__Environment__Location'
    value: location
  }
  // Blob Storage Configuration
  {
    name: 'STORAGE_ACCOUNT_NAME'
    value: storage.outputs.storageAccountName
  }
  {
    name: 'BLOB_CONTAINER_NAME'
    value: storageAccountPptsContainerName
  }
  // Cosmos DB Configuration
  {
    name: 'COSMOS_DB_ENDPOINT'
    value: cosmosDb.outputs.endpoint
  }
  {
    name: 'COSMOS_DB_DATABASE_NAME'
    value: cosmosDbDatabaseName
  }
  {
    name: 'COSMOS_DB_PPT_CONTAINER_NAME'
    value: cosmosDbPptContainerName
  }
  {
    name: 'COSMOS_DB_USER_CONTAINER_NAME'
    value: cosmosDbUserContainerName
  }
  // Service Bus Configuration
  {
    name: 'SERVICE_BUS_NAMESPACE'
    value: serviceBus.outputs.serviceBusNamespaceName
  }
  {
    name: 'SERVICE_BUS_TOPIC_NAME'
    value: serviceBus.outputs.topicName
  }
  {
    name: 'SERVICE_BUS_IMAGE_SUBSCRIPTION_NAME'
    value: serviceBus.outputs.imageSubscriptionName
  }
  {
    name: 'SERVICE_BUS_SCRIPT_SUBSCRIPTION_NAME'
    value: serviceBus.outputs.scriptSubscriptionName
  }
  {
    name: 'SERVICE_BUS_VIDEO_GENERATION_QUEUE_NAME'
    value: serviceBus.outputs.queueVideoGeneratorName
  }
  {
    name: 'SERVICE_BUS_VIDEO_TRANSFORMATION_QUEUE_NAME'
    value: serviceBus.outputs.queueVideoTransformationName
  }
  {
    name: 'SERVICE_BUS_VIDEO_CONCATENATION_QUEUE_NAME'
    value: serviceBus.outputs.queueVideoConcatenatorName
  }
  {
    name: 'SPEECH_ENDPOINT'
    value: 'https://my-ai-cdn.cognitiveservices.azure.com/'
  }
]

// ███    ███  ██████  ██████  ██    ██ ██      ███████ ███████ 
// ████  ████ ██    ██ ██   ██ ██    ██ ██      ██      ██      
// ██ ████ ██ ██    ██ ██   ██ ██    ██ ██      █████   ███████ 
// ██  ██  ██ ██    ██ ██   ██ ██    ██ ██      ██           ██ 
// ██      ██  ██████  ██████   ██████  ███████ ███████ ███████ 

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

resource rgSpeechService 'Microsoft.Resources/resourceGroups@2021-04-01' existing = {
  name: speechServiceResourceGroupName
}

// 1. Deploy the identity module
module identities './modules/identity/main.bicep' = {
  name: 'identities-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    userAssignedIdentityApiName: userAssignedIdentityApiName
    userAssignedIdentityExtractorsName: userAssignedIdentityExtractorsName
    userAssignedIdentityUiName: userAssignedIdentityUiName
    userAssignedIdentityVideosName: userAssignedIdentityVideosName
  }
}

module assignSpeechRole './modules/identity/assign-speech-role.bicep' = {
  name: 'assign-speech-role'
  scope: rgSpeechService
  params: {
    speechServiceResourceId: speechServiceResourceId
    videosPrincipalId: identities.outputs.videosIdentityPrincipalId
  }
}

// 2. Deploy the monitoring module
module monitoring './modules/monitoring/main.bicep' = {
  name: 'monitoring-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    abbrs: abbrs
  }
}

// 3. Deploy the storage module
module storage './modules/storage-account/main.bicep' = {
  name: 'storage-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    storageAccountName: storageAccountName
    storageAccountSkuName: storageAccountSkuName
    storageAccountPptsContainerName: storageAccountPptsContainerName
    apiPrincipalId: identities.outputs.apiIdentityPrincipalId
    extractorsPrincipalId: identities.outputs.extractorsIdentityPrincipalId
    videosPrincipalId: identities.outputs.videosIdentityPrincipalId
  }
}

// 4. Deploy the Cosmos DB module
module cosmosDb './modules/cosmos/main.bicep' = {
  name: 'cosmosdb-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    cosmosDbAccountName: cosmosDbAccountName
    cosmosDbDatabaseName: cosmosDbDatabaseName
    cosmosDbPptContainerName: cosmosDbPptContainerName
    cosmosDbUserContainerName: cosmosDbUserContainerName
    apiPrincipalId: identities.outputs.apiIdentityPrincipalId
    extractorsPrincipalId: identities.outputs.extractorsIdentityPrincipalId
    videosPrincipalId: identities.outputs.videosIdentityPrincipalId
  }
}

// 5. Deploy the Service Bus module
module serviceBus './modules/service-bus/main.bicep' = {
  name: 'servicebus-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    serviceBusNamespaceName: serviceBusNamespaceName
    serviceBusTopicName: serviceBusTopicName
    serviceBusSubscriptionNameImage: serviceBusSubscriptionNameImage
    serviceBusSubscriptionNameScript: serviceBusSubscriptionNameScript
    serviceBusQueueVideoGeneratorName: serviceBusQueueVideoGeneratorName
    serviceBusQueueVideoTransformationName: serviceBusQueueVideoTransformationName
    serviceBusQueueVideoConcatenatorName: serviceBusQueueVideoConcatenatorName
    apiPrincipalId: identities.outputs.apiIdentityPrincipalId
    extractorsPrincipalId: identities.outputs.extractorsIdentityPrincipalId
    videosPrincipalId: identities.outputs.videosIdentityPrincipalId
  }
}

// 6. Deploy the Container Registry module
module registry './modules/container-registry/main.bicep' = {
  name: 'registry-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    abbrs: abbrs
    apiPrincipalId: identities.outputs.apiIdentityPrincipalId
    extractorsPrincipalId: identities.outputs.extractorsIdentityPrincipalId
    uiPrincipalId: identities.outputs.uiIdentityPrincipalId
    videosPrincipalId: identities.outputs.videosIdentityPrincipalId
  }
}

// 7. Deploy the Container Apps module
module containerApps './modules/container-apps/main.bicep' = {
  name: 'container-apps-deployment'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    abbrs: abbrs
    logAnalyticsWorkspaceResourceId: monitoring.outputs.logAnalyticsWorkspaceResourceId
    containerRegistryLoginServer: registry.outputs.loginServer
    apiIdentityId: identities.outputs.apiIdentityId
    apiIdentityClientId: identities.outputs.apiIdentityClientId
    extractorsIdentityId: identities.outputs.extractorsIdentityId
    extractorsIdentityClientId: identities.outputs.extractorsIdentityClientId
    uiIdentityId: identities.outputs.uiIdentityId
    uiIdentityClientId: identities.outputs.uiIdentityClientId
    videosIdentityId: identities.outputs.videosIdentityId
    videosIdentityClientId: identities.outputs.videosIdentityClientId
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    apiExists: apiExists
    imageExtractorExists: imageExtractorExists
    scriptExtractorExists: scriptExtractorExists
    uiExists: uiExists
    videoGeneratorExists: videoGeneratorExists
    videoTransformationExists: videoTransformationExists
    videoConcatenatorExists: videoConcatenatorExists
    commonEnvVariables: env_variables
  }
}

//  ██████  ██    ██ ████████ ██████  ██    ██ ████████ ███████ 
// ██    ██ ██    ██    ██    ██   ██ ██    ██    ██    ██      
// ██    ██ ██    ██    ██    ██████  ██    ██    ██    ███████ 
// ██    ██ ██    ██    ██    ██      ██    ██    ██         ██ 
//  ██████   ██████     ██    ██       ██████     ██    ███████ 

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_RESOURCE_API_ID string = containerApps.outputs.apiResourceId
output AZURE_RESOURCE_EXTRACTOR_IMAGE string = containerApps.outputs.imageExtractorResourceId
output AZURE_RESOURCE_EXTRACTOR_SCRIPT string = containerApps.outputs.scriptExtractorResourceId
output AZURE_RESOURCE_UI_ID string = containerApps.outputs.uiResourceId
output API_BASE_URL string = 'https://${containerApps.outputs.apiFqdn}'
