# specify the node base image with your desired version node:<version>
FROM node:16.13.0
# replace this with your application's default port
EXPOSE 8888

ENV PORT 8888

COPY ./ ./

RUN npm install

RUN ln -s /usr/local/bin/nodejs /usr/bin/node

CMD ["npm", "start"]