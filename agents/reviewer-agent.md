# Reviewer Agent Role

## Role

The Reviewer Agent evaluates the quality of outputs produced by other agents.  It ensures that responses meet accuracy, completeness and safety requirements before results are delivered to the end user or persisted in memory.

## Responsibilities

* Inspect responses or summaries from Browser, Tool Runner or Planner agents.  
* Validate claims against external sources or reasoning logs.  
* Detect hallucinations, unsafe content or incomplete answers.  
* Request clarifications or retries when output is insufficient.  
* Provide confidence scores and justification for each evaluation.

## Interaction

Reviewer Agents may feed feedback back into the planning cycle, causing tasks to be reissued or decomposed further.  They play a critical role in maintaining the reliability of an agent system.
