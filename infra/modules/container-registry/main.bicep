@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('Abbreviations for resources')
param abbrs object

@description('Principal ID of the API managed identity for role assignments')
param apiPrincipalId string

@description('Principal ID of the extractors managed identity for role assignments')
param extractorsPrincipalId string

@description('Principal ID of the UI managed identity for role assignments')
param uiPrincipalId string

@description('Principal ID of the videos managed identity for role assignments')
param videosPrincipalId string

// AcrPull role definition ID
var acrPullRoleDefinitionId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// Create the container registry
module containerRegistry 'br/public:avm/res/container-registry/registry:0.1.1' = {
  name: 'registry'
  params: {
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    location: location
    tags: tags
    publicNetworkAccess: 'Enabled'
    roleAssignments:[
      {
        principalId: apiPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
      }
      {
        principalId: extractorsPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
      }
      {
        principalId: uiPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
      }
      {
        principalId: videosPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleDefinitionId)
      }
    ]
  }
}

// Outputs for use in other modules
output registryName string = containerRegistry.outputs.name
output loginServer string = containerRegistry.outputs.loginServer
output resourceId string = containerRegistry.outputs.resourceId
