## Deploy

Site is available at https://birds.xaviershay.com

    bin/deploy           # Push latest code

    # Database
    export CLOUDFLARE_API_TOKEN=secret
    npx wrangler d1 execute birds --remote --file=db/migrations/somefile.sql
    bin/load-data-remote

    # Sync data/photos
    bin/generate-thumbnails
    bin/extract-photo-metadata
    bin/sync-photos

### TODO

* Figure out why page takes 100ms (prob database?)
* New mapbox API key
* Restrict font-awesome hosting to domains
* Document architecture and dev setup in README.
* Terraform for birds{,-gallery}.xaviershay.com, SSL cert

### eBird API wants

* Exotic flags in exported observation data (example: https://ebird.org/checklist/S220837850). Use case: my own list calculations can match that of eBird.
* JSON API for download observations rather than request emailed file. Use case: easier to refresh my own calculations/dashboard.
* Ability to fetch lists of other users' (where displayed publicly). Use case: build some social features with my friends, e.g. "which bird have I seen that you haven't? I can show you" or "which bird in a region have neither of us seen"