@description('Resource ID of the storage account to retrieve keys for')
param storageAccountResourceId string

// Get the storage account reference
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' existing = {
  name: last(split(storageAccountResourceId, '/'))
}

// Use the listKeys API to get the storage account key
var storageAccountKey = storageAccount.listKeys().keys[0].value

// Output the storage account key
@secure()
output STORAGE_ACCOUNT_KEY string = storageAccountKey
