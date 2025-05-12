# FROM node:19-alpine as build

# WORKDIR /app

# COPY package*.json ./
# RUN npm install

# COPY . .
# RUN npm run build

# FROM nginx:alpine
# COPY --from=build /app/build /usr/share/nginx/html

# EXPOSE 3000

# # Start Nginx server
# CMD ["nginx", "-g", "daemon off;"]

FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the React app
RUN npm run build

# Install a simple server to serve the static files
RUN npm install -g serve

# Expose the port
EXPOSE 3000

# Start the server
CMD ["serve", "-s", "build", "-l", "3000"]