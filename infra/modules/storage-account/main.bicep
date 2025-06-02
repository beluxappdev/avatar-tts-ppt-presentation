@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('The storage account name')
param storageAccountName string = 'stavatartts'

@description('The storage account SKU name')
param storageAccountSkuName string = 'Standard_LRS'

@description('The name of the container that stores the PowerPoints in the storage account')
param storageAccountPptsContainerName string = 'ppts'

@description('Principal ID of the API managed identity for role assignments')
param apiPrincipalId string

@description('Principal ID of the extractors managed identity for role assignments')
param extractorsPrincipalId string

@description('Principal ID of the videos managed identity for role assignments')
param videosPrincipalId string

// Create the storage account
module storageAccount 'br/public:avm/res/storage/storage-account:0.19.0' = {
  name: storageAccountName
  params: {
    name: '${storageAccountName}${resourceToken}'
    location: location
    tags: tags
    kind: 'BlobStorage'
    skuName: storageAccountSkuName
    publicNetworkAccess: 'Enabled'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'  // This is the key setting - 'Allow' means allow from everywhere
      bypass: 'AzureServices'
    }
    blobServices: {
      automaticSnapshotPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 10
      containerDeleteRetentionPolicyEnabled: true
      containers: [
        {
          name: storageAccountPptsContainerName
          publicAccess: 'None'
        }
      ]
    }
    roleAssignments: [
      {
        principalId: apiPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
      {
        principalId: extractorsPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
      {
        principalId: videosPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
    ]
  }
}

// Module to retrieve storage account key
module retrieveStKey './retrieve-st-key.bicep' = {
  name: 'retrieve-st-key'
  params: {
    storageAccountResourceId: storageAccount.outputs.resourceId
  }
}

// Outputs for use in other modules
output storageAccountName string = storageAccount.outputs.name
output storageAccountResourceId string = storageAccount.outputs.resourceId
output primaryBlobEndpoint string = storageAccount.outputs.primaryBlobEndpoint
@secure()
output storageAccountKey string = retrieveStKey.outputs.STORAGE_ACCOUNT_KEY
