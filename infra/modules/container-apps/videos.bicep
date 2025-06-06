@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Container Apps environment resource ID')
param environmentId string

@description('Container Registry login server')
param containerRegistryLoginServer string

@description('Speech Service endpoint for the video generator container apps')
param speechServiceEndpoint string

@description('User-assigned identity resource ID for the extractors')
param videosIdentityId string

@description('User-assigned identity client ID for the extractors')
param videosIdentityClientId string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Whether the video generator container app already exists')
param videoGeneratorExists bool

@description('Whether the video transformation container app already exists')
param videoTransformationExists bool

@description('Whether the video concatenator container app already exists')
param videoConcatenatorExists bool

@description('Environment variables for all container apps')
param commonEnvVariables array = []

// Fetch the latest image for the video generator
module videoGeneratorFetchLatestImage './fetch-container-image.bicep' = {
  name: 'video-fetch-generator'
  params: {
    exists: videoGeneratorExists
    name: 'video-generator'
  }
}

// Fetch the latest image for the video transformation
module videoTransformationFetchLatestImage './fetch-container-image.bicep' = {
  name: 'video-fetch-transformation'
  params: {
    exists: videoTransformationExists
    name: 'video-transformation'
  }
}

// Fetch the latest image for the video concatenator
module videoConcatenatorFetchLatestImage './fetch-container-image.bicep' = {
  name: 'vide-fetch-concatenator'
  params: {
    exists: videoConcatenatorExists
    name: 'video-concatenator'
  }
}

// Create the image extractor container app
module videoGenerator 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'video-generator'
  params: {
    name: 'video-generator'
    disableIngress: true
    scaleMinReplicas: 80
    scaleMaxReplicas: 200
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: videoGeneratorFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: concat([
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: videosIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: videosIdentityClientId
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [videosIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: videosIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'video-generator' })
  }
}

// module videoGenerators 'br/public:avm/res/app/container-app:0.8.0' = [for (endpoint, index) in speechServiceEndpoints: {
//   name: 'video-generator-${index + 1}'
//   params: {
//     name: 'video-generator-${index + 1}'
//     disableIngress: true
//     scaleMinReplicas: 1
//     scaleMaxReplicas: 10
//     secrets: {
//       secureList: []
//     }
//     containers: [
//       {
//         image: videoGeneratorFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
//         name: 'main'
//         resources: {
//           cpu: json('0.5')
//           memory: '1.0Gi'
//         }
//         env: concat([
//           {
//             name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
//             value: applicationInsightsConnectionString
//           }
//           {
//             name: 'AZURE_CLIENT_ID'
//             value: videosIdentityClientId
//           }
//           {
//             name: 'AzureServices__ManagedIdentity__ClientId'
//             value: videosIdentityClientId
//           }
//           {
//             name: 'SPEECH_ENDPOINT'
//             value: endpoint
//           }
//         ], commonEnvVariables)
//       }
//     ]
//     managedIdentities: {
//       systemAssigned: false
//       userAssignedResourceIds: [videosIdentityId]
//     }
//     registries: [
//       {
//         server: containerRegistryLoginServer
//         identity: videosIdentityId
//       }
//     ]
//     environmentResourceId: environmentId
//     location: location
//     tags: union(tags, { 'azd-service-name': 'video-generator-${index + 1}' })
//   }
// }]

module videoTransformation 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'video-transformation'
  params: {
    name: 'video-transformation'
    disableIngress: true
    scaleMinReplicas: 200
    scaleMaxReplicas: 300
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: videoTransformationFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('2')
          memory: '4.0Gi'
        }
        env: concat([
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: videosIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: videosIdentityClientId
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [videosIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: videosIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'video-transformation' })
  }
}

// Create the script extractor container app
module videoConcatenator 'br/public:avm/res/app/container-app:0.8.0' = {
  name: 'video-concatenator'
  params: {
    name: 'video-concatenator'
    disableIngress: true
    scaleMinReplicas: 10
    scaleMaxReplicas: 20
    secrets: {
      secureList: []
    }
    containers: [
      {
        image: videoConcatenatorFetchLatestImage.outputs.?containers[?0].?image ?? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        name: 'main'
        resources: {
          cpu: json('0.5')
          memory: '1.0Gi'
        }
        env: concat([
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: applicationInsightsConnectionString
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: videosIdentityClientId
          }
          {
            name: 'AzureServices__ManagedIdentity__ClientId'
            value: videosIdentityClientId
          }
        ], commonEnvVariables)
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [videosIdentityId]
    }
    registries: [
      {
        server: containerRegistryLoginServer
        identity: videosIdentityId
      }
    ]
    environmentResourceId: environmentId
    location: location
    tags: union(tags, { 'azd-service-name': 'video-concatenator' })
  }
}

// Outputs for use in other modules
output videoConcatenatorResourceId string = videoConcatenator.outputs.resourceId
output videoConcatenatorName string = videoConcatenator.outputs.name
