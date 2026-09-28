pipeline {

    agent {
        label 'agent-1'
    }

    tools {
        jdk 'jdk-11'
        maven 'maven'
    }

    environment {
        IMAGE_NAME = "java-app"
        IMAGE_TAG = "sayedatwhdevops/java-app"
        IMAGE_VERSION = "v${BUILD_NUMBER}"
        CONTAINER_NAME = "java-app"
    }

    stages {

        stage("Build Java Application") {
            steps {
                sh 'mvn clean package -DskipTests=true'
            }
        }

        stage("Test Java Application") {
            steps {
                sh 'mvn test'
            }
        }

        stage("Build Docker Image") {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${IMAGE_VERSION} .'
            }
        }

        stage("Docker Login into DockerHub") {
            steps {
                withCredentials([
                    string(credentialsId: 'DOCKER_USERNAME', variable: 'DOCKER_USERNAME'),
                    string(credentialsId: 'DOCKER_PASSWORD', variable: 'DOCKER_PASSWORD')
                ]) {
                    sh '''
                        echo "$DOCKER_PASSWORD" | docker login \
                        -u "$DOCKER_USERNAME" \
                        --password-stdin
                    '''
                }
            }
        }

        stage("Push Docker Image") {
            steps {
                sh 'docker tag ${IMAGE_NAME}:${IMAGE_VERSION} ${IMAGE_TAG}:${IMAGE_VERSION}'
                sh 'docker push ${IMAGE_TAG}:${IMAGE_VERSION}'
            }
        }

        stage("Update Kubernetes Manifest") {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-credentials',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_TOKEN'
                    )
                ]) {
                    sh '''
                        sed -i "s|image: .*|image: ${IMAGE_TAG}:${IMAGE_VERSION}|" K8S/deployment.yml
                        git config user.name "Jenkins"
                        git config user.email "jenkins@sayedatwh"
                        git add K8S/deployment.yml
                        git commit -m "Update image to ${IMAGE_VERSION}" || true
                        git push https://github.com/SayedAtwh/DevOps-End-to-End-AWS-GitOps-Platform.git HEAD:main
                    '''
                }
            }
        }
    }
}