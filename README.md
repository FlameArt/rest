# REST JS

Promise based, easy and fast methods for MySQL requests.

    npm install flamerest --save

## Usage

```
import FLAMEREST from "flamerest";
Vue.use(new FLAMEREST([custom_endpoint]));
```

or

```
import FLAMEREST from "flamerest";
window.REST = new FLAMEREST('localhost');
```

# Create and Update

Just field list, but any field can be HTML Input, or FileList (automatically restify that)