#!/bin/bash

read -r -d '' js <<'EOF'
{
	fps: 5,
	layout: 1,
	config: {
		strands: [{
			id: 1,
			start: 0,
			end: 49,
		}],
		layouts: [{
			id: 1,
			dimensions: [ 5, 10 ],
		}],
		animations: [{
			id: 1,
			frames: [
				{
					fill: 0xff0000,
					time: 1,
				},
				{
					dissolve: true,
					time: 1,
				},
				{
					fill: 0x00ff00,
					time: 1,
				},
			]
		}],
		playback: [{
			id: 1,
			animationId: 1,
			layoutId: 1,
		}],
	}
}
EOF
json=$(node -pe "JSON.stringify($js)")

echo $json |
curl -H "Content-Type: application/json" \
	--data @- \
	http://localhost:8080/api/preview
