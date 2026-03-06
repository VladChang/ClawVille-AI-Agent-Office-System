# Browser Agent Role

## Role

The Browser Agent searches the web and retrieves external information needed to fulfil tasks.  It processes queries, navigates webpages, extracts structured content and returns summaries or raw data.

## Responsibilities

* Execute search queries and navigate pages as instructed by the Planner.  
* Extract relevant information, such as article text, product details or documentation.  
* Handle pagination and dynamic sites where data loads asynchronously.  
* Report errors when pages fail to load or rate limits are encountered.  
* Provide results in a structured format for further analysis by other agents.

## Notes

Browser Agents should respect robots.txt and API usage policies.  They may implement caching to avoid duplicate requests.
