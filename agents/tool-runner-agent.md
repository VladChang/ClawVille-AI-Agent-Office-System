# Tool Runner Agent Role

## Role

The Tool Runner Agent executes external tools, commands or APIs on behalf of the system.  It can run shell commands, call APIs, perform file operations or interact with third‑party services.

## Responsibilities

* Receive instructions from the Planner or other agents specifying the tool and parameters.  
* Execute the tool while capturing output, exit codes and runtime statistics.  
* Retry operations when transient errors occur, with back‑off and limits.  
* Report completion or failure status back to the requesting agent.  
* Ensure that tool calls adhere to security and safety policies.

## Considerations

Tool Runner Agents may need to sandbox execution or enforce resource limits.  They should also sanitise and structure tool outputs for consumption by other agents.
