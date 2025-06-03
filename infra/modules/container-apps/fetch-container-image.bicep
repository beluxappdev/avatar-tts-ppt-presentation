@description('Determines if the container app already exists')
param exists bool

@description('Name of the container app')
param name string

resource existingApp 'Microsoft.App/containerApps@2023-05-02-preview' existing = if (exists) {
  name: name
}

output containers array = exists ? existingApp.properties.template.containers : []
