import urllib.request
import json

base_url = "http://pubsub-emulator:8085/v1/projects/digikawsay"

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

for t in topics:
    try:
        req = urllib.request.Request(f"{base_url}/topics/{t}", method="PUT")
        urllib.request.urlopen(req)
        print(f"Topic {t} created")
    except Exception as e:
        print(f"Error topic {t}: {e}")

for t, s in subs.items():
    try:
        data = json.dumps({"topic": f"projects/digikawsay/topics/{t}"}).encode('utf-8')
        req = urllib.request.Request(f"{base_url}/subscriptions/{s}", data=data, method="PUT")
        req.add_header('Content-Type', 'application/json')
        urllib.request.urlopen(req)
        print(f"Sub {s} created")
    except Exception as e:
        print(f"Error sub {s}: {e}")
