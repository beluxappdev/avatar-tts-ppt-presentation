@description('Resource ID of the storage account to retrieve keys for')
param serviceBusNamespaceResourceId string

// Get the storage account reference
resource serviceBus 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = {
  name: last(split(serviceBusNamespaceResourceId, '/'))
}

// Use the listKeys API to get the storage account key
var endpoint = '${serviceBus.id}/AuthorizationRules/RootManageSharedAccessKey'
var connectionString = 'Endpoint=sb://${serviceBus.name}.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=${listKeys(endpoint, serviceBus.apiVersion).primaryKey}'

// Output the storage account key
@secure()
output SERVICE_BUS_CONNECTION_STRING string = connectionString
