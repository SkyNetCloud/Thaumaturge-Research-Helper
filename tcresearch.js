$(function () {
	var darkModeToggle = document.querySelector("#check");
	var darkModeSaved = localStorage.getItem("darkMode") === "true";

	darkModeToggle.checked = darkModeSaved;
	document.body.classList.toggle("dark-mode", darkModeSaved);

	darkModeToggle.addEventListener("change", function () {
		document.body.classList.toggle("dark-mode", this.checked);
		localStorage.setItem("darkMode", this.checked);
	});
	var latest_version = "Thaumaturge 26.1.2";
	$.each(version_dictionary, function (key, version) {
		$("#version").append('<option value="' + key + '">' + key + '</option>');
	});

	var aspects = [];
	var combinations = {};
	var originalAspectIcons = {};
	var tintedAspectIcons = {};
	var aspectColorsPromise = null;
	$("#version").val(latest_version);
	var version = latest_version;
	var graph = {};
	function connect(aspect1, aspect2) {
		function addConnection(from, to) {
			if (!(from in graph)) graph[from] = [];
			graph[from].push(to);
		}
		addConnection(aspect1, aspect2);
		addConnection(aspect2, aspect1);
	}
	function aspectSort(a, b) {
		return (a == b) ? 0 : (translate[a] < translate[b]) ? -1 : 1;
	}
	function ddDataSort(a, b) {
		return (a.text == b.text) ? 0 : (a.text < b.text) ? -1 : 1;
	}
	function find(from, to, steps) {
		function search(queue, to, visited) {
			while (!queue.isEmpty()) {
				var element = queue.dequeue();
				var node = element.path.pop();
				if (!(node in visited) || visited[node].indexOf(element.path.length) < 0) {
					element.path.push(node);
					if (node == to && element.path.length > steps + 1) return element.path;
					graph[node].forEach(function (entry) {
						var newpath = element.path.slice();
						newpath.push(entry);
						queue.enqueue({ "path": newpath, "length": element.length + getWeight(entry) });
					});
					if (!(node in visited)) visited[node] = [];
					visited[node].push(element.path.length - 1);
				}
			}
			return null;
		}

		var queue = new buckets.PriorityQueue(function (a, b) {
			return b.length - a.length;
		});
		queue.enqueue({ "path": [from], "length": 0 });
		var visited = {};
		return search(queue, to, visited);
	}
	function formatAspectName(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

	var steps = $("#spinner").spinner({
		min: 1,
		max: 10
	});
	reset_aspects();
	$("#find_connection").click(function () {
		run();
	});
	$("#sel_all").click(function () {
		$("#avail .aspect").each(function () {
			setAspectAvailable(this, true);
		});
	});
	$("#desel_all").click(function () {
		$("#avail .aspect").each(function () {
			setAspectAvailable(this, false);
		});
	});
	$("#version").change(function () {
		version = $("#version").val();
		$(".result").dialog("close");
		reset_aspects();
	});
	$("#avail").on("click", ".aspect", function () {
		setAspectAvailable(this, this.classList.contains("unavail"));
	});
	$("body").on("mouseenter", ".aspectlist .aspect", function () {
		var aspect = $(this).attr("id");
		if (combinations[aspect]) {
			var combination = combinations[aspect];
			$("#combination_box").data("aspect", aspect);
			$("#combination_box #left").html('<img src="aspects/color/' + combination[0] + '.png" /><div class="name">' + formatAspectName(translate[combination[0]]) + '</div><div class="desc">' + combination[0] + '</div>');
			$("#combination_box #right").html('<img src="aspects/color/' + combination[1] + '.png" /><div class="name">' + formatAspectName(translate[combination[1]]) + '</div><div class="desc">' + combination[1] + '</div>');
			$("#combination_box #equals").html('<img src="aspects/color/' + aspect + '.png" /><div class="name">' + formatAspectName(translate[aspect]) + '</div><div class="desc">' + aspect + '</div>');
			setCombinationPreviewIcon("left", combination[0], aspect);
			setCombinationPreviewIcon("right", combination[1], aspect);
			setCombinationPreviewIcon("equals", aspect, aspect);
			$(this).mousemove(function (e) {
				$("#combination_box").css({ left: e.pageX + 10, top: e.pageY - 100 }).show();
			});
		} else {
			$("#combination_box").removeData("aspect");
			$("#combination_box").hide();
		}
	});
	$("body").on("mouseleave", ".aspectlist .aspect", function () {
		$("#combination_box").removeData("aspect");
		$("#combination_box").hide();
	});
	$("#close_results").click(function () {
		$(".result").dialog("close");
	});

	function setAspectAvailable(element, available) {
		var image = element.querySelector("img");
		if (!image) return;

		element.classList.toggle("unavail", !available);
		element.dataset.tintRequest = String((Number(element.dataset.tintRequest) || 0) + 1);

		if (!available) {
			image.src = originalAspectIcons[element.id] || ("aspects/color/" + element.id + ".png");
			return;
		}

		if (!originalAspectIcons[element.id]) {
			originalAspectIcons[element.id] = "aspects/color/" + element.id + ".png";
		}

		if (tintedAspectIcons[element.id]) {
			image.src = tintedAspectIcons[element.id];
			return;
		}

		var requestId = element.dataset.tintRequest;
		getTintedAspectIcon(element.id).then(function (tintedIcon) {
			updateAspectDropdownIcons(element.id, tintedIcon);
			if (!element.classList.contains("unavail") && element.dataset.tintRequest === requestId) {
				image.src = tintedIcon;
			}
		}).catch(function (error) {
			console.error("Could not tint aspect icon " + element.id + ":", error);
		});
	}

	function updateAspectDropdownIcons(aspect, tintedIcon) {
		$(".select2-container .aspect").each(function () {
			if (this.id === aspect) {
				var image = this.querySelector("img");
				if (image) {
					image.src = tintedIcon;
				}
			}
		});
	}

	function setCombinationPreviewIcon(slot, aspect, previewAspect) {
		getTintedAspectIcon(aspect).then(function (tintedIcon) {
			if ($("#combination_box").data("aspect") === previewAspect) {
				$("#combination_box #" + slot + " img").attr("src", tintedIcon);
			}
		}).catch(function (error) {
			console.error("Could not tint combination preview icon " + aspect + ":", error);
		});
	}

	function getTintedAspectIcon(aspect) {
		if (tintedAspectIcons[aspect]) {
			return Promise.resolve(tintedAspectIcons[aspect]);
		}
		if (!originalAspectIcons[aspect]) {
			originalAspectIcons[aspect] = "aspects/color/" + aspect + ".png";
		}

		return getAspectColors()
			.then(function (colors) {
				var color = colors[aspect];
				if (!Number.isInteger(color) || color < 0 || color > 0xFFFFFF) {
					throw new Error("Missing or invalid numeric color for " + aspect);
				}

				return new Promise(function (resolve, reject) {
					var sourceImage = new Image();
					sourceImage.onload = function () {
						var canvas = document.createElement("canvas");
						canvas.width = sourceImage.naturalWidth;
						canvas.height = sourceImage.naturalHeight;
						var context = canvas.getContext("2d");
						if (!context) {
							reject(new Error("Could not create canvas context"));
							return;
						}

						try {
							context.drawImage(sourceImage, 0, 0);
							var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
							var red = (color >> 16) & 255;
							var green = (color >> 8) & 255;
							var blue = color & 255;

							for (var i = 0; i < pixels.data.length; i += 4) {
								var brightness =
									(pixels.data[i] * 0.299 +
										pixels.data[i + 1] * 0.587 +
										pixels.data[i + 2] * 0.114) / 255;

								pixels.data[i] = Math.round(red * brightness);
								pixels.data[i + 1] = Math.round(green * brightness);
								pixels.data[i + 2] = Math.round(blue * brightness);
							}

							context.putImageData(pixels, 0, 0);
							tintedAspectIcons[aspect] = canvas.toDataURL("image/png");
							resolve(tintedAspectIcons[aspect]);
						} catch (error) {
							reject(error);
						}
					};
					sourceImage.onerror = function () {
						reject(new Error("Could not load original aspect icon"));
					};
					sourceImage.src = originalAspectIcons[aspect];
				});
			});
	}

	function getAspectColors() {
		if (!aspectColorsPromise) {
			aspectColorsPromise = fetch("aspects-color.json")
				.then(function (response) {
					if (!response.ok) {
						throw new Error("Could not load aspect colors (HTTP " + response.status + ")");
					}
					return response.json();
				})
				.catch(function (error) {
					aspectColorsPromise = null;
					throw error;
				});
		}
		return aspectColorsPromise;
	}


	function reset_aspects() {
		aspects = $.extend([], version_dictionary[version]["base_aspects"]);
		combinations = $.extend(true, {}, version_dictionary[version]["combinations"]);
		$("#avail").empty();
		$('#fromSel,#toSel').select2('destroy')
		var tier_aspects = [];
		$.each(combinations, function (aspect, value) {
			tier_aspects.push(aspect);
		});
		tier_aspects = tier_aspects.sort(aspectSort);
		aspects = aspects.concat(tier_aspects);
		aspects.forEach(function (aspect) {
			$('#avail').append('<li class="aspect" id="' + aspect + '"><img src="aspects/color/' + aspect + '.png" /><div>' + formatAspectName(translate[aspect]) + '</div><div class="desc">' + aspect + '</div></li>');
		});
		$("#avail .aspect").each(function () {
			setAspectAvailable(this, true);
		});
		var ddData = [];
		aspects.forEach(function (aspect) {
			//I have to use the 'aspect' as 'text' because i need it in the matcher function to access the translated version of it.
			ddData.push({ text: aspect, id: aspect });
		});
		ddData.sort(ddDataSort);
		function format(d) {
			var aspect = d.id;
			var icon = tintedAspectIcons[aspect] || "aspects/color/" + aspect + ".png";
			return '<div class="aspect" id="' + aspect + '"><img style="margin: 4px 5px 0 0" src="' + icon + '" /><div>' + formatAspectName(translate[aspect]) + '</div><div class="desc">' + aspect + '</div></div>'
		}
		$('#toSel,#fromSel').select2({
			data: ddData,
			formatResult: format,
			formatSelection: format,
			width: '200px',
			allowClear: false,
			sortResults: function (results, container, query) {
				return results.sort(function (a, b) {
					console.log(a, b)
					return translate[a.id].localeCompare(translate[b.id]);
				});
			},
			matcher: function (search, text) { return text.toUpperCase().indexOf(search.toUpperCase()) >= 0 || translate[text].toUpperCase().indexOf(search.toUpperCase()) >= 0 }
		});
		$('#toSel,#fromSel').select2("val", "aer");
		graph = {};
		for (var compound in combinations) {
			connect(compound, combinations[compound][0]);
			connect(compound, combinations[compound][1]);
		}
	}
	function run() {
		var fromSel = $('#fromSel').select2("val");
		var toSel = $('#toSel').select2("val");
		var path = find(fromSel, toSel, steps.spinner("value"));
		var id = fromSel + 'to' + toSel;
		var title = formatAspectName(translate[fromSel]) + ' &rarr; ' + formatAspectName(translate[toSel]);
		var step_count = 0;
		var aspect_count = {};
		$.each(aspects, function (aspect, value) {
			aspect_count[value] = 0;
		});
		$('#' + id).remove();
		$("body").append('<ul id="' + id + '" class="aspectlist result" title="' + title + '"></ul>');
		$('#' + id).dialog({
			autoOpen: false,
			modal: false,
			resizable: false,
			width: 200
		});
		$('#' + id).append("<div></div>");
		var loop_count = 0;
		path.forEach(function (e) {
			loop_count++;
			if (loop_count != 1 && loop_count != path.length) {
				aspect_count[e]++;
				step_count++;
			}
			$('#' + id).append('<li class="aspect_result aspect" id="' + e + '"><img src="aspects/color/' + e + '.png" /><div>' + formatAspectName(translate[e]) + '</div><div class="desc">' + e + '</div></li><li>↓</li>');
		});
		$('#' + id).children().last().remove();
		$('#' + id).append('<li id="aspects_used">Aspects Used</li>');
		var used = '<ul id="aspects_used_list">';
		$.each(aspect_count, function (aspect, value) {
			if (value > 0) {
				used = $(used).append('<li title="' + translate[aspect] + ': ' + value + '" style="background-image:url(\'aspects/color/' + aspect + '.png\')">' + value + '</li>');
			}
		});
		used = $(used).append("<div>Total Steps: " + step_count + "</div>");
		used = $(used).append('</ul>');
		$('#' + id).append(used);
		$('#' + id).dialog("open");
	}
	function getWeight(aspect) {
		var el = $("#" + aspect);
		return (el.hasClass("unavail")) ? 100 : 1;
	}
});
