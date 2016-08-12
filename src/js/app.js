MP.api.setCredentials('acb6588802b8678c797c1fdc8863bc27');

// Strings used as param values or MP api calls
var todayString = '';
var yearStart = '2016-01-01';

function getToday() {
	var today = new Date();
	var d = today.getDay().toString();
	var m = (today.getMonth() + 1).toString();
	var y = today.getFullYear().toString();
	todayString = y + '-' + m + '-' + d;
}

// Sets of real-time looping interval to run queries every 12 seconds
function runInterval() {
	runQueries();
	setInterval(function() {
		runQueries();
	}, 12000);
}

// Run all queries
function runQueries() {
	console.log("Querying...");
	queryNewTrials();
	queryBlogs();
	queryChannels();
	queryRetention();
}

// Return a range of dates in JQL format for the previous month
// Returns a two-item array, with a from and to
function calculateLastMonth() {
	var today = new Date();
	var day = today.getDay();
	var month = (today.getMonth()).toString();
	var year = today.getFullYear();		

	if (month === '0') {	// Prior month to January is December
		month = '12';
	}
	else if (month.length === 1) {
		month = '0' + month;	// Prepend 0 for months under 10
	}

	// Establish final day of month (varies by month)
	var lastDate = 31;
	if (month === '02' && year % 4 === 0) {
		lastDate = 29; // leap Year
	} else if (month === '02') {
		lastDate = 28;
	} else if (month === '04' || month === '06' || month === '09' || month === '11') {
		lastDate = 30;
	}

	var start = year + '-' + month + '-' + '01';
	var end = year + '-' + month + '-' + lastDate;
	return [start, end];
}

// Query to accumulate last month's number of new trials set up
function queryNewTrials() {
	var component = this;
	var dateRanges = component.calculateLastMonth();
	var params = {
		start_date: dateRanges[0],
		end_date: dateRanges[1]
	}

	MP.api.jql(function main() {
	  return Events({
	    from_date: params.start_date,
	    to_date:   params.end_date
	  })
	  
	  // Pull only events whose names are "Sign up for Trial"
	  .filter(function(events) {
	    return (events.name === "Sign up for Trial");
	  })
	  
	  // Sum the total number of events
	  .reduce(mixpanel.reducer.count());
	  }, params)

	  // Set the state to reflect the total
	  .done(function(results) {
	  	document.getElementById('trial-count').innerHTML = results[0].toLocaleString();
	});
}

// Run queries to gather top blog posts by their name and number of visits
function queryBlogs() {
	var params = {
		from_date: yearStart,
		to_date: todayString
	};	

	MP.api.jql(function main() {
	  return Events({
	    from_date: params.from_date,
	    to_date:   params.to_date
	  })
	  
	  .filter(function(events) {
	    return (events.name === "View Blog");
	  })

	  .groupBy(["properties.Blog Title"], mixpanel.reducer.count());
	  }, params)

	.done(function(results) {		
		// Create Blog Table DOM elements
		var tableBody = document.getElementById('blog-table-body');

		// Clear table
		while (tableBody.firstChild) {
			tableBody.removeChild(tableBody.firstChild);
		}

		for (var i = results.length-1; i >= 0; i--) {
			var tr = document.createElement('tr');

			var blog = results[i];
			var blogName = document.createElement('td');
			blogName.innerHTML = blog["key"][0];

			var blogVisits = document.createElement('td');
			blogVisits.innerHTML = blog["value"].toLocaleString();

			tr.appendChild(blogName);
			tr.appendChild(blogVisits);

			tableBody.appendChild(tr);
		}
	});
}

// Query to group events by their campaign source (FB, Twitter, etc)
function queryChannels() {
	var params = {
		from_date: yearStart,
		to_date: todayString
	};

	MP.api.jql(function main() {
	  return Events({
	    from_date: params.from_date,
	    to_date:   params.to_date
	  })
	  .groupBy(["properties.Campaign Source"], mixpanel.reducer.count());
	}, params)

	.done(function(results) {
		// Sort Channels by impact, calculate each channel's percentage impact
		var sortedChannels = [];
		var channelCpy = results;
		while (channelCpy.length > 0) {
			var currentChannel = channelCpy.splice(0, 1)[0];
			if (sortedChannels.length === 0) {
				sortedChannels.push(currentChannel);
				continue;
			}
			// Insertion sort into sorted array
			for (var k = 0; k < sortedChannels.length; k++) {
				if (currentChannel.value > sortedChannels[k].value) {
					sortedChannels.splice(k, 0, currentChannel);
					break;
				}
				else if (k === sortedChannels.length - 1) {
					sortedChannels.push(currentChannel);
					break;
				}
			}
		}
		var total = 0;
		for (var channel of sortedChannels) {
			total += channel.value;
		}

		// Clear existing metric bars
		var barWrapper = document.getElementById('bars');
		while (barWrapper.firstChild) {
			barWrapper.removeChild(barWrapper.firstChild);
		}

		// Clear existing key elements
		var keyWrapper = document.getElementById('key');
		while (keyWrapper.firstChild) {
			keyWrapper.removeChild(keyWrapper.firstChild);
		}

		// Turn sorted channels into DOM elements w/ graph & key
		var channelBarColors = ["#27eacc", "#fa5d81", "#b371ea", "#fea200", "#42abff", "#5d27ff"];
		for (var x = 0; x < sortedChannels.length; x++) {
			var channel = sortedChannels[x];
			var ratio = (Math.round((channel.value / total) * 100)).toString();
			var ratioCSS = ratio + "%";

			var barElement = document.createElement('div');
			barElement.className = 'channel-bar';
			barElement.style.backgroundColor = channelBarColors[x];
			barElement.style.width = ratioCSS;

			// Append bar to wrapper
			barWrapper.appendChild(barElement);

			var itemWrapper = document.createElement('div');
			itemWrapper.className = 'channel-key-item-wrapper';

			var keyBlock = document.createElement('div');
			keyBlock.className = 'channel-key-block';
			keyBlock.style.backgroundColor = channelBarColors[x];
			itemWrapper.appendChild(keyBlock);

			var keyName = document.createElement('div');
			keyName.className = 'channel-key-name';
			keyName.innerHTML = channel.key[0];
			itemWrapper.appendChild(keyName);

			var keyRatio = document.createElement('div');
			keyRatio.className = 'channel-key-ratio';
			keyRatio.innerHTML = "(" + ratioCSS + ")";
			itemWrapper.appendChild(keyRatio);

			keyWrapper.appendChild(itemWrapper);
		}
	});
}

// Query to get retention, defined as users who have completed a session,
// and whose total sessions is >= 4
function queryRetention() {
	var params = {
		from: moment().subtract(21, 'days'),
		to: moment().subtract(2, 'days'),
		unit: 'day',

		where: 'properties["Complete Session Count"] >= 4',
	}

	MP.api.retention('Complete Session', params).done(function(results) {
		$('#table-retention').MPTable({
			data: results.json,
			showPercentages: true,
			firstColHeader: 'Date'
		});
	});
}

// Get date, start running queries on an interval
getToday();
runInterval();
