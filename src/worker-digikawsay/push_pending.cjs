const { execSync } = require('child_process');

async function main() {
    console.log("Fetching pending directives...");
    const out = execSync('npx wrangler d1 execute DB --remote --command="SELECT participant_id, project_id, content, urgency FROM wizard_directives WHERE status=\'PENDING\';" --json', { encoding: 'utf8' });
    
    // The output from wrangler is an array of objects
    const data = JSON.parse(out);
    const results = data[0].results;
    
    console.log(`Found ${results.length} pending directives. Pushing them...`);
    
    for (const directive of results) {
        console.log(`Pushing to ${directive.participant_id}...`);
        
        const params = new URLSearchParams();
        params.append('participant_id', directive.participant_id);
        params.append('project_id', directive.project_id);
        params.append('content', directive.content);
        params.append('urgency', directive.urgency || 'HIGH');
        params.append('action', 'push');
        
        try {
            const res = await fetch('https://worker-digikawsay.camilo-carvajalino.workers.dev/admin/inject_directive_web', {
                method: 'POST',
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            console.log(`Response status: ${res.status}`);
        } catch (e) {
            console.error(`Error pushing to ${directive.participant_id}:`, e);
        }
        
        // Wait a bit to not overwhelm the LLM API quota (Gemini rate limits)
        await new Promise(r => setTimeout(r, 4000));
    }
    
    console.log("All pending directives have been pushed!");
    
    console.log("Cleaning up old pending directives...");
    execSync('npx wrangler d1 execute DB --remote --command="UPDATE wizard_directives SET status=\'APPLIED\' WHERE status=\'PENDING\';"', { encoding: 'utf8' });
    console.log("Done.");
}

main().catch(console.error);
