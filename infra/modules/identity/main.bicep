@description('The location used for all deployed resources')
param location string

@description('Tags that will be applied to all resources')
param tags object = {}

@description('Name for the API user-assigned managed identity')
param userAssignedIdentityApiName string

@description('Name for the extractors user-assigned managed identity')
param userAssignedIdentityExtractorsName string

@description('Name for the UI user-assigned managed identity')
param userAssignedIdentityUiName string

@description('Name for the videos user-assigned managed identity')
param userAssignedIdentityVideosName string

// Create the user-assigned managed identity for API
module userAssignedIdentityApi 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: userAssignedIdentityApiName
  params: {
    name: userAssignedIdentityApiName
    location: location
    tags: tags
  }
}

// Create the user-assigned managed identity for extractors
module userAssignedIdentityExtractors 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: userAssignedIdentityExtractorsName
  params: {
    name: userAssignedIdentityExtractorsName
    location: location
    tags: tags
  }
}

// Create the user-assigned managed identity for UI
module userAssignedIdentityUi 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: userAssignedIdentityUiName
  params: {
    name: userAssignedIdentityUiName
    location: location
    tags: tags
  }
}

// Create the user-assigned managed identity for videos
module userAssignedIdentityVideos 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: userAssignedIdentityVideosName
  params: {
    name: userAssignedIdentityVideosName
    location: location
    tags: tags
  }
}

// Outputs for use in other modules
output apiIdentityId string = userAssignedIdentityApi.outputs.resourceId
output apiIdentityPrincipalId string = userAssignedIdentityApi.outputs.principalId
output apiIdentityClientId string = userAssignedIdentityApi.outputs.clientId

output extractorsIdentityId string = userAssignedIdentityExtractors.outputs.resourceId
output extractorsIdentityPrincipalId string = userAssignedIdentityExtractors.outputs.principalId
output extractorsIdentityClientId string = userAssignedIdentityExtractors.outputs.clientId

output uiIdentityId string = userAssignedIdentityUi.outputs.resourceId
output uiIdentityPrincipalId string = userAssignedIdentityUi.outputs.principalId
output uiIdentityClientId string = userAssignedIdentityUi.outputs.clientId

output videosIdentityId string = userAssignedIdentityVideos.outputs.resourceId
output videosIdentityPrincipalId string = userAssignedIdentityVideos.outputs.principalId
output videosIdentityClientId string = userAssignedIdentityVideos.outputs.clientId
