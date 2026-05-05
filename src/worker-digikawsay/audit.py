import json
import os
import io

def load_json(filepath):
    if not os.path.exists(filepath):
        return []
    
    # Try reading with different encodings because PowerShell `>` might use utf-16
    encodings = ['utf-16', 'utf-8', 'utf-8-sig']
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                content = f.read()
                
                # Strip wrangler output logs
                start = content.find('[')
                end = content.rfind(']')
                if start != -1 and end != -1:
                    json_str = content[start:end+1]
                    data = json.loads(json_str)
                    return data[0].get('results', [])
        except Exception as e:
            continue
    return []

turns = load_json('dump.json')
states = load_json('states.json')
directives = load_json('directives.json')
gaps = load_json('gaps.json')

print(f"Loaded {len(turns)} dialogue turns.")
print(f"Loaded {len(states)} dialogue states.")
print(f"Loaded {len(directives)} wizard directives.")
print(f"Loaded {len(gaps)} data gaps.")

# --- VAL Audit ---
print("\n=== VAL AGENT AUDIT ===")
if turns:
    latencies = []
    for t in turns:
        lat = t.get('latency_ms')
        if lat is not None:
            latencies.append(lat)
        elif t.get('topics'):
            try:
                top = json.loads(t['topics'])
                if top.get('metadata') and top['metadata'].get('latency_ms'):
                    latencies.append(top['metadata']['latency_ms'])
            except:
                pass
    if latencies:
        avg_latency = sum(latencies) / len(latencies)
        print(f"Average Latency: {avg_latency:.2f} ms")
    else:
        print("Average Latency: N/A (no latency data)")
    
    registers = {}
    for t in turns:
        reg = t.get('emotional_register')
        if reg: registers[reg] = registers.get(reg, 0) + 1
    print(f"Emotional Registers Distribution: {registers}")
    
    speech_acts = {}
    for t in turns:
        act = t.get('speech_act')
        if act: speech_acts[act] = speech_acts.get(act, 0) + 1
    print(f"Speech Acts Distribution: {speech_acts}")
else:
    print("No dialogue turns available.")

# --- AG-05 Audit ---
print("\n=== AG-05 AGENT AUDIT ===")
ag05_directives = [d for d in directives if d.get('issued_by') == 'AG-05']
print(f"Directives issued by AG-05: {len(ag05_directives)}")

if ag05_directives:
    statuses = {}
    for d in ag05_directives:
        s = d.get('status')
        if s: statuses[s] = statuses.get(s, 0) + 1
    print(f"Status of AG-05 Directives: {statuses}")

if gaps:
    gaps_by_agent = {}
    for g in gaps:
        agent = g.get('agent_id')
        if agent: gaps_by_agent[agent] = gaps_by_agent.get(agent, 0) + 1
    print(f"Data Gaps created by Agents: {gaps_by_agent}")
    
    gaps_status = {}
    for g in gaps:
        agent = g.get('agent_id')
        if agent == 'AG-05':
            s = g.get('status')
            if s: gaps_status[s] = gaps_status.get(s, 0) + 1
    print(f"Status of Data Gaps by AG-05: {gaps_status}")
else:
    print("No data gaps available.")

