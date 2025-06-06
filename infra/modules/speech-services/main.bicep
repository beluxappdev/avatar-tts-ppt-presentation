param location string

param tags object

param resourceToken string

param speechServiceBaseName string
param speechServiceCount int

param apimPrincipalId string

var uniqueSuffix = uniqueString(resourceToken, location, speechServiceBaseName)

module speechServices 'br/public:avm/res/cognitive-services/account:0.10.2' = [for i in range(1, speechServiceCount): {
  name: 'speechService${i}Deployment'
  params: {
    kind: 'SpeechServices'
    tags: tags
    name: '${speechServiceBaseName}-${uniqueSuffix}-${i}'
    customSubDomainName: '${speechServiceBaseName}-${uniqueSuffix}-${i}'
    location: location
    sku: 'S0'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    roleAssignments: [
      {
        principalId: apimPrincipalId
        roleDefinitionIdOrName: 'Cognitive Services Speech Contributor'
        principalType: 'ServicePrincipal'
      }
    ]
  }
}]

output speechServicesNames array = [for i in range(1, speechServiceCount): speechServices[i-1].outputs.name]
output speechServicesIds array = [for i in range(1, speechServiceCount): speechServices[i-1].outputs.resourceId]
