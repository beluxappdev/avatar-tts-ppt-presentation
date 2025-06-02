targetScope = 'resourceGroup'

@description('The resource ID of the Speech Service')
param speechServiceResourceId string

@description('The principal ID of the videos managed identity')
param videosPrincipalId string

@description('Generate a unique name for the role assignment')
var roleAssignmentName = guid(speechServiceResourceId, videosPrincipalId, 'f2dc8367-1007-4938-bd23-fe263f013447')


// Parse the resource ID to get subscription, resource group, and resource name
var speechServiceSubscriptionId = split(speechServiceResourceId, '/')[2]
var speechServiceName = split(speechServiceResourceId, '/')[8]

// Reference the existing Speech Service
resource speechService 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: speechServiceName
}

// Assign Cognitive Services Speech Contributor role to videos identity
resource speechServiceRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName 
  scope: speechService
  properties: {
    roleDefinitionId: subscriptionResourceId(speechServiceSubscriptionId, 'Microsoft.Authorization/roleDefinitions', 'f2dc8367-1007-4938-bd23-fe263f013447') // Cognitive Services Speech Contributor
    principalId: videosPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = speechServiceRoleAssignment.id
