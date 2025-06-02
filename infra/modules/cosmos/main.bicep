@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('Cosmos DB account name')
param cosmosDbAccountName string

@description('Cosmos DB database name')
param cosmosDbDatabaseName string

@description('Cosmos DB powerpoints container name')
param cosmosDbPptContainerName string

@description('Cosmos DB users container name')
param cosmosDbUserContainerName string

@description('Principal ID of the API managed identity for role assignments')
param apiPrincipalId string

@description('Principal ID of the extractors managed identity for role assignments')
param extractorsPrincipalId string

@description('Principal ID of the videos managed identity for role assignments')
param videosPrincipalId string

// Create the Cosmos DB account
module cosmosDb 'br/public:avm/res/document-db/database-account:0.13.0' = {
  name: cosmosDbAccountName
  params: {
    name: '${cosmosDbAccountName}${resourceToken}'
    location: location
    tags: tags    

    // Core properties
    databaseAccountOfferType: 'Standard'
    enableMultipleWriteLocations: false
    capabilitiesToAdd: [
      'EnableServerless'
    ]
    
    // Network configuration
    networkRestrictions: {
      publicNetworkAccess: 'Enabled'
      virtualNetworkRules: []
      ipRules: []
    }
    
    // Security settings
    disableKeyBasedMetadataWriteAccess: false
    disableLocalAuth: false
    
    // Feature flags
    enableFreeTier: false
    enableAnalyticalStorage: false
    
    // TLS settings
    minimumTlsVersion: 'Tls12'
    
    // Consistency policy
    defaultConsistencyLevel: 'Session'
    maxIntervalInSeconds: 5
    maxStalenessPrefix: 100
    
    // Backup policy
    backupPolicyType: 'Periodic'
    backupIntervalInMinutes: 240
    backupRetentionIntervalInHours: 8
    backupStorageRedundancy: 'Geo'
    
    // Capacity settings
    totalThroughputLimit: 4000
    
    // SQL Databases
    sqlDatabases: [
      {
        name: cosmosDbDatabaseName
        containers: [
          {
            name: cosmosDbPptContainerName
            paths: [
              '/userId'
            ]
            kind: 'Hash'
            version: 2
            indexingPolicy: {
              indexingMode: 'consistent'
              automatic: true
              includedPaths: [
                {
                  path: '/*'
                }
              ]
              excludedPaths: [
                {
                  path: '/"_etag"/?'
                }
              ]
            }
            conflictResolutionPolicy: {
              mode: 'LastWriterWins'
              conflictResolutionPath: '/_ts'
            }
          }
          {
            name: cosmosDbUserContainerName
            paths: [
              '/id'
            ]
            kind: 'Hash'
            version: 2
            indexingPolicy: {
              indexingMode: 'consistent'
              automatic: true
              includedPaths: [
                {
                  path: '/*'
                }
              ]
              excludedPaths: [
                {
                  path: '/"_etag"/?'
                }
              ]
            }
            conflictResolutionPolicy: {
              mode: 'LastWriterWins'
              conflictResolutionPath: '/_ts'
            }
          }
        ]
      }
    ]
  }
}

// Reference to the deployed Cosmos DB account
resource existingCosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' existing = {
  name: '${cosmosDbAccountName}${resourceToken}'
}

// Use static GUIDs for role assignments
// In production, you might want to generate these with a tool rather than hardcoding
resource apiSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-11-15' = {
  parent: existingCosmosDbAccount
  name: '11111111-1111-1111-1111-111111111111' // Static GUID for API role
  properties: {
    roleDefinitionId: '${existingCosmosDbAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002' // Built-in Data Contributor
    principalId: apiPrincipalId
    scope: existingCosmosDbAccount.id
  }
  dependsOn: [
    cosmosDb
  ]
}

resource extractorsSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-11-15' = {
  parent: existingCosmosDbAccount
  name: '22222222-2222-2222-2222-222222222222' // Static GUID for extractors role
  properties: {
    roleDefinitionId: '${existingCosmosDbAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002' // Built-in Data Contributor
    principalId: extractorsPrincipalId
    scope: existingCosmosDbAccount.id
  }
  dependsOn: [
    cosmosDb
  ]
}

resource videosSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-11-15' = {
  parent: existingCosmosDbAccount
  name: '33333333-3333-3333-3333-333333333333' // Static GUID for extractors role
  properties: {
    roleDefinitionId: '${existingCosmosDbAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002' // Built-in Data Contributor
    principalId: videosPrincipalId
    scope: existingCosmosDbAccount.id
  }
  dependsOn: [
    cosmosDb
  ]
}

// Outputs for use in other modules
output cosmosDbAccountName string = '${cosmosDbAccountName}${resourceToken}'
output endpoint string = cosmosDb.outputs.endpoint
output resourceId string = cosmosDb.outputs.resourceId
