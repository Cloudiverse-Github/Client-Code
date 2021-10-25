
docker container prune
docker build -t cloudiverse_client ./
docker run -p 81:8888 cloudiverse_client 