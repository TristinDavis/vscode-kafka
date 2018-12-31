import * as kafka from "kafka-node";

import { Disposable } from "vscode";

export interface Broker {
    id: string;
    host: string;
    port: number;
    isController: boolean;
    isConnected: boolean;
}

export interface Topic {
    name: string;
}

export class Client implements Disposable {
    private kafkaClient: any;
    private host: string;

    private metadata: {
        topics: Topic[];
        brokers: Broker[];
    };

    constructor(bootstrap: string) {
        this.metadata = {
            brokers: [],
            topics: [],
        };

        this.host = bootstrap;
    }

    connect(): Promise<void> {
        this.kafkaClient = new kafka.KafkaClient({
            autoConnect: false,
            connectRetryOptions: {
                retries: 1,
            },
            connectTimeout: 3000,
            kafkaHost: this.host,
        });

        return new Promise((resolve, reject) => {
            this.kafkaClient.connect();
            this.kafkaClient.on("ready", () => {
                this.kafkaClient.loadMetadataForTopics([], (error: any, result: any) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    this.metadata = this.parseMetadataResponse(result);
                    resolve();
                });
            });

            this.kafkaClient.on("error", (error: any) => {
                reject(error);
            });
        });
    }

    getTopics(): Topic[] {
        return this.metadata.topics;
    }

    getBrokers(): Broker[] {
        return this.metadata.brokers;
    }

    dispose() {
        if (this.kafkaClient) {
            this.kafkaClient.close();
        }
    }

    private parseMetadataResponse(response: any[]): { topics: Topic[], brokers: Broker[] } {
        return {
            brokers: this.parseBrokers(response[0], response[1].clusterMetadata),
            topics: this.parseTopics(response[1].metadata),
        };
    }

    private parseTopics(topicMetadata: any): Topic[] {
        return Object.keys(topicMetadata).map((topicName) => {
            return {
                name: topicName,
            };
        });
    }

    private parseBrokers(brokerMetadata: any, clusterMetadata: any): Broker[] {
        const brokerIds = Object.keys(brokerMetadata);

        const brokers: Broker[] = brokerIds.map((brokerId) => {
            const brokerData = brokerMetadata[brokerId];

            const brokerWrapper = this.kafkaClient.getBrokers()[brokerData.host + ":" + brokerData.port];
            let isConnected = false;

            if (brokerWrapper) {
                isConnected = brokerWrapper.isReady();
            }

            return {
                id: brokerId,
                host: brokerData.host,
                port: brokerData.port,
                isController: brokerId === clusterMetadata.controllerId.toString(),
                isConnected,
            };
        });

        return brokers;
    }
}