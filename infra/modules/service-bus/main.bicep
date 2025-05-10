// servicebus.bicep

@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Unique string for resource naming')
param resourceToken string

@description('Service Bus namespace name')
param serviceBusNamespaceName string = 'sbavatartts'

@description('Service Bus topic name')
param serviceBusTopicName string = 'ppt-uploaded'

@description('Service Bus subscription name for image extractor')
param serviceBusSubscriptionNameImage string = 'image-extractor'

@description('Service Bus subscription name for script extractor')
param serviceBusSubscriptionNameScript string = 'script-extractor'

@description('Principal ID of the API managed identity for role assignments')
param apiPrincipalId string

@description('Principal ID of the extractors managed identity for role assignments')
param extractorsPrincipalId string

// Create Service Bus namespace and topics/subscriptions
module serviceBusNamespace 'br/public:avm/res/service-bus/namespace:0.14.1' = {
  name: serviceBusNamespaceName
  params: {
    name: '${serviceBusNamespaceName}${resourceToken}'
    location: location
    tags: tags
    
    // SKU configuration
    skuObject: {
      name: 'Standard'
      capacity: 1
    }
    
    // Zone redundancy
    zoneRedundant: true
    
    // TLS settings
    minimumTlsVersion: '1.2'
    
    // Authentication and security settings
    disableLocalAuth: false
    
    // Networking configuration
    publicNetworkAccess: 'Enabled'
    networkRuleSets: {
      publicNetworkAccess: 'Enabled'
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
      trustedServiceAccessEnabled: false
    }
    
    // Capacity settings (for Premium SKU)
    premiumMessagingPartitions: 0
    
    // Default authorization rules
    authorizationRules: [
      {
        name: 'RootManageSharedAccessKey'
        rights: [
          'Listen'
          'Manage'
          'Send'
        ]
      }
    ]
    
    // Topics configuration
    topics: [
      {
        name: serviceBusTopicName
        maxMessageSizeInKilobytes: 256
        defaultMessageTimeToLive: 'P14D'
        maxSizeInMegabytes: 2048
        requiresDuplicateDetection: false
        duplicateDetectionHistoryTimeWindow: 'PT10M'
        enableBatchedOperations: true
        status: 'Active'
        supportOrdering: false
        autoDeleteOnIdle: 'P10675199DT2H48M5.4775807S'
        enablePartitioning: false
        enableExpress: false
        
        // Topic subscriptions
        subscriptions: [
          {
            name: serviceBusSubscriptionNameImage
            isClientAffine: false
            lockDuration: 'PT1M'
            requiresSession: false
            defaultMessageTimeToLive: 'P14D'
            deadLetteringOnMessageExpiration: false
            deadLetteringOnFilterEvaluationExceptions: false
            maxDeliveryCount: 10
            status: 'Active'
            enableBatchedOperations: true
            autoDeleteOnIdle: 'P10675198DT2H48M5.477S'
            
            // Subscription rules
            rules: [
              {
                name: '$Default'
                filterType: 'SqlFilter'
                sqlFilter: {
                  sqlExpression: '1=1'
                  compatibilityLevel: 20
                }
                action: {}
              }
            ]
          }
          {
            name: serviceBusSubscriptionNameScript
            isClientAffine: false
            lockDuration: 'PT1M'
            requiresSession: false
            defaultMessageTimeToLive: 'P14D'
            deadLetteringOnMessageExpiration: false
            deadLetteringOnFilterEvaluationExceptions: false
            maxDeliveryCount: 10
            status: 'Active'
            enableBatchedOperations: true
            autoDeleteOnIdle: 'P10675198DT2H48M5.477S'
            
            // Subscription rules
            rules: [
              {
                name: '$Default'
                filterType: 'SqlFilter'
                sqlFilter: {
                  sqlExpression: '1=1'
                  compatibilityLevel: 20
                }
                action: {}
              }
            ]
          }
        ]
      }
    ]
    roleAssignments: [
      {
        principalId: apiPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Azure Service Bus Data Sender'
      }
      {
        principalId: extractorsPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Azure Service Bus Data Receiver'
      }
    ]
  }
}

// Outputs for use in other modules
output serviceBusNamespaceName string = '${serviceBusNamespaceName}${resourceToken}'
output serviceBusEndpoint string = '${serviceBusNamespaceName}${resourceToken}.servicebus.windows.net'
output resourceId string = serviceBusNamespace.outputs.resourceId
output topicName string = serviceBusTopicName
output imageSubscriptionName string = serviceBusSubscriptionNameImage
output scriptSubscriptionName string = serviceBusSubscriptionNameScript
