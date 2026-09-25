# syntax=docker/dockerfile:1

# ---- Build: Maven + JDK 21 --------------------------------------------------
# Maven comes from the image, so the build does not depend on mvnw.cmd, which
# is Windows-only. The test suite runs here (it uses an in-memory H2 database
# and needs no secrets): a failing test stops the deploy instead of shipping.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Dependencies first, so source-only changes reuse this cached layer.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B package && cp target/catering-identity-*.jar /app/app.jar

# ---- Runtime: JRE 21 only ---------------------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN useradd --system --uid 10001 --home-dir /app app
COPY --from=build /app/app.jar /app/app.jar
USER app

# Java 21 is container-aware; this only caps the heap at a share of the
# container's memory so metaspace and threads fit on a 512 MB instance.
# Override JAVA_TOOL_OPTIONS in the host's environment if the plan is larger.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0"

# Spring reads PORT (server.port=${PORT:8081}); Render supplies it.
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
