param tags object
param resourceToken string
param apimName string
param apiMgmtIdentityId string
param apiMgmtIdentityClientId string
param speechServicesNames string[]

// Generate the when conditions dynamically with proper formatting for separate resource
var whenConditions = [for (serviceName, index) in speechServicesNames: ' <when condition="@((int)context.Variables[&quot;backendIndex&quot;] == ${index})">\r\n <set-backend-service base-url="https://${serviceName}.cognitiveservices.azure.com" />\r\n </when>']

// Join all when conditions
var allWhenConditions = join(whenConditions, '\r\n')

// Create the complete policy XML with session affinity logic and proper formatting
var policiesXml = '<policies>\r\n <inbound>\r\n <base />\r\n <authentication-managed-identity resource="https://cognitiveservices.azure.com/" client-id="${apiMgmtIdentityClientId}" />\r\n <!-- Extract job_id from the URL path and calculate consistent backend index -->\r\n <set-variable name="jobId" value="@(context.Request.MatchedParameters.ContainsKey(&quot;job_id&quot;) ? context.Request.MatchedParameters[&quot;job_id&quot;] : &quot;&quot;)" />\r\n <set-variable name="backendIndex" value="@{\r\n var jobId = context.Variables.GetValueOrDefault&lt;string&gt;(&quot;jobId&quot;, &quot;&quot;);\r\n if (string.IsNullOrEmpty(jobId)) {\r\n return (new Random()).Next(0, ${length(speechServicesNames)});\r\n }\r\n var hash = jobId.GetHashCode();\r\n return Math.Abs(hash) % ${length(speechServicesNames)};\r\n }" />\r\n <choose>\r\n${allWhenConditions}\r\n <otherwise>\r\n <set-backend-service base-url="https://${speechServicesNames[0]}.cognitiveservices.azure.com" />\r\n </otherwise>\r\n </choose>\r\n </inbound>\r\n <backend>\r\n <base />\r\n </backend>\r\n <outbound>\r\n <base />\r\n </outbound>\r\n <on-error>\r\n <base />\r\n </on-error>\r\n</policies>'

module apim 'br/public:avm/res/api-management/service:0.9.1' = {
  name: 'apim'
  params: {
    // Required parameters
    name: '${apimName}-${resourceToken}'
    sku: 'Consumption'
    tags: tags
    publisherEmail: 'apimgmt-noreply@mail.windowsazure.com'
    publisherName: 'az-amorg-x-001'
    apis: [
      {
        name: 'speech-router'
        displayName: 'Speech Router'
        description: 'API for routing speech requests to the appropriate service.'
        protocols: ['https']
        subscriptionRequired: false
        path: 'speech'
        apiRevision: '1'
        isCurrent: true
        policies: [
          {
            name: 'policy'
            format: 'xml'
            value: policiesXml
          }
        ]
      }
    ]
    managedIdentities: {
      systemAssigned: false
      userAssignedResourceIds: [
        apiMgmtIdentityId
      ]
    }
  }
}

// Reference the existing APIM service
resource apimService 'Microsoft.ApiManagement/service@2024-06-01-preview' existing = {
  name: '${apimName}-${resourceToken}'
}

// Reference the existing API created by the AVM module
resource speechRouterApi 'Microsoft.ApiManagement/service/apis@2024-06-01-preview' existing = {
  parent: apimService
  name: 'speech-router'
}

// Create operations as separate resources with proper parent references
resource speechGetOperation 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  parent: speechRouterApi
  name: 'speech-get'
  properties: {
    displayName: 'speech-get'
    method: 'GET'
    urlTemplate: '/avatar/batchsyntheses/{job_id}?api-version={api_version}'
    templateParameters: [
      {
        name: 'job_id'
        required: true
        values: []
        type: 'string'
      }
      {
        name: 'api_version'
        required: true
        values: []
        type: 'string'
      }
    ]
    responses: []
  }
  dependsOn: [
    apim
  ]
}

resource speechPutOperation 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  parent: speechRouterApi
  name: 'speech-put'
  properties: {
    displayName: 'speech-put'
    method: 'PUT'
    urlTemplate: '/avatar/batchsyntheses/{job_id}?api-version={api_version}'
    templateParameters: [
      {
        name: 'job_id'
        required: true
        values: []
        type: 'string'
      }
      {
        name: 'api_version'
        required: true
        values: []
        type: 'string'
      }
    ]
    responses: []
  }
  dependsOn: [
    apim
  ]
}

output apimSpeechRouterUrl string = 'https://${apim.outputs.name}.azure-api.net/speech'
