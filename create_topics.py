import os
from google.cloud import pubsub_v1

PROJECT_ID = "my-local-project"
# Note that PUBSUB_EMULATOR_HOST must be set prior to running this script
print(f"PUBSUB_EMULATOR_HOST IS {os.getenv('PUBSUB_EMULATOR_HOST')}")
topics = [
    "iap.dead.letter",
    "iap.seed.input",
    "iap.channel.inbound",
    "iap.channel.outbound",
    "iap.val.packet",
    "iap.val.to.ag00",
    "iap.orchestrator.directive",
    "iap.alerts.safe_harbor",
    "iap.swarm.ag05",
    "iap.swarm.output"
]
subs = {
    "iap.channel.inbound": "preprocessor-inbound-sub",
    "iap.val.packet": "val-packet-sub",
    "iap.orchestrator.directive": "val-directive-sub",
    "iap.val.to.ag00": "ag00-val-packet-sub",
    "iap.channel.outbound": "channel-outbound-sub",
    "iap.swarm.ag05": "ag05-swarm-sub",
    "iap.swarm.output": "ag00-swarm-output-sub"
}

publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()

for t in topics:
    path = publisher.topic_path(PROJECT_ID, t)
    try:
        publisher.create_topic(request={"name": path})
        print(f"Topic created: {t}")
    except Exception as e:
        print(f"Topic {t} might exist or error: {e}")

for t, s in subs.items():
    t_path = publisher.topic_path(PROJECT_ID, t)
    s_path = subscriber.subscription_path(PROJECT_ID, s)
    try:
        subscriber.create_subscription(request={"name": s_path, "topic": t_path})
        print(f"Sub created: {s}")
    except Exception as e:
        print(f"Sub {s} might exist or error: {e}")
