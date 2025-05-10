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

// Create the Container Apps environment
module containerAppsEnvironment 'br/public:avm/res/app/managed-environment:0.4.5' = {
  name: 'environment'
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    tags: tags
    logAnalyticsWorkspaceResourceId: logAnalyticsWorkspaceResourceId
    location: location
    zoneRedundant: false
  }
}

// Outputs for use in other modules
output environmentId string = containerAppsEnvironment.outputs.resourceId
output defaultDomain string = containerAppsEnvironment.outputs.defaultDomain
output name string = containerAppsEnvironment.outputs.name
