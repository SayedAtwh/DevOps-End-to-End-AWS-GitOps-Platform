FROM maven:3.9.9-eclipse-temurin-11 AS build
WORKDIR /workspace

COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:11-jre-jammy
WORKDIR /app

COPY --from=build /workspace/target/demo1-0.0.1-SNAPSHOT.jar /app/app.jar

ENV SERVER_PORT=8090
EXPOSE 8090

USER 10001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
