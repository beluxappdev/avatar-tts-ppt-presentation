targetScope = 'resourceGroup'

@description('The resource ID of the Speech Service')
param speechServiceResourceIds string[]

@description('The principal ID of the videos managed identity')
param videosPrincipalId string

// Loop through each Speech Service resource ID
resource speechServiceRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (speechServiceResourceId, index) in speechServiceResourceIds: {
  name: guid(speechServiceResourceId, videosPrincipalId, 'f2dc8367-1007-4938-bd23-fe263f013447')
  scope: speechServices[index]
  properties: {
    roleDefinitionId: subscriptionResourceId(split(speechServiceResourceId, '/')[2], 'Microsoft.Authorization/roleDefinitions', 'f2dc8367-1007-4938-bd23-fe263f013447') // Cognitive Services Speech Contributor
    principalId: videosPrincipalId
    principalType: 'ServicePrincipal'
  }
}]

// Reference the existing Speech Services
resource speechServices 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = [for speechServiceResourceId in speechServiceResourceIds: {
  name: split(speechServiceResourceId, '/')[8]
}]

output roleAssignmentIds array = [for i in range(0, length(speechServiceResourceIds)): speechServiceRoleAssignments[i].id]
