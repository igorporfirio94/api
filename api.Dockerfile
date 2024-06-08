FROM node:14

WORKDIR /app

COPY package.json /app/
RUN npm install

COPY api/ /app/api
COPY services/ /app/services

CMD ["npm", "start"]
