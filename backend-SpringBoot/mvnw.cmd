@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements. See the NOTICE file
@REM distributed with this work for additional information.
@REM ----------------------------------------------------------------------------
@SET "__MVNW_HOME__=%USERPROFILE%\.m2\wrapper\dists\apache-maven-3.9.9"
@SET "__MVNW_CMD__=%__MVNW_HOME__%\apache-maven-3.9.9\bin\mvn.cmd"
@IF NOT EXIST "%__MVNW_CMD__%" powershell -NoProfile -Command "$mavenDir='%__MVNW_HOME__%'; New-Item -ItemType Directory -Force $mavenDir | Out-Null; $zip=Join-Path $mavenDir 'maven.zip'; Invoke-WebRequest -UseBasicParsing 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip' -OutFile $zip; Expand-Archive -Force $zip $mavenDir; Remove-Item $zip"
@IF EXIST "%__MVNW_CMD__%" (CALL "%__MVNW_CMD__%" %*) ELSE (ECHO Unable to download or locate Maven 1>&2 & EXIT /B 1)
