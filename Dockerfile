FROM node:10-alpine as package
WORKDIR /opt/gifserver
COPY package.json yarn.lock ./
RUN yarn
COPY . .

FROM package as dist
CMD [ "node", "./" ]
