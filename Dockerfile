# specify the node base image with your desired version node:<version>
FROM node:14.17.6
# replace this with your application's default port
EXPOSE 8888

ENV PORT 8888

COPY ./ ./

RUN npm install

RUN npm --prefix ./code install

CMD ["npm", "start"]