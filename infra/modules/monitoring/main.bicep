@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('Abbreviations for resources')
param abbrs object

// Create Azure Monitor resources (Log Analytics workspace, Application Insights, Dashboard)
module monitoring 'br/public:avm/ptn/azd/monitoring:0.1.0' = {
  name: 'monitoring'
  params: {
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
    applicationInsightsDashboardName: '${abbrs.portalDashboards}${resourceToken}'
    location: location
    tags: tags
  }
}

// Outputs for use in other modules
output logAnalyticsWorkspaceName string = monitoring.outputs.logAnalyticsWorkspaceName
output logAnalyticsWorkspaceResourceId string = monitoring.outputs.logAnalyticsWorkspaceResourceId
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
output applicationInsightsConnectionString string = monitoring.outputs.applicationInsightsConnectionString
output applicationInsightsInstrumentationKey string = monitoring.outputs.applicationInsightsInstrumentationKey
