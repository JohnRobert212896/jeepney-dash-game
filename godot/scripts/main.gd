extends Node2D

const VIEW_W := 540.0
const VIEW_H := 960.0
const ROAD_LEFT := 64.0
const ROAD_RIGHT := 476.0
const ROAD_TOP := 92.0
const PLAYER_Y := 722.0
const LANE_X := [132.0, 270.0, 408.0]

const INK := Color("#071426")
const NAVY := Color("#0b1f3a")
const ROAD := Color("#263442")
const ROAD_EDGE := Color("#d8e1e8")
const YELLOW := Color("#ffd34d")
const ORANGE := Color("#ff8a2b")
const CYAN := Color("#65c9ff")
const GREEN := Color("#4bd38b")
const RED := Color("#ff5964")
const WHITE := Color("#f8fbff")

enum GameState { MENU, PLAYING, PAUSED, GAME_OVER }

var game_state := GameState.MENU
var rng := RandomNumberGenerator.new()
var ui_font: Font

var lane_index := 1
var player_x := LANE_X[1]
var target_x := LANE_X[1]
var fuel := 100.0
var hearts := 3
var distance := 0.0
var fare := 0
var coins_collected := 0
var passengers := 0
var combo := 0
var score := 0
var best_score := 0
var world_speed := 315.0
var road_offset := 0.0
var scenery_offset := 0.0
var invulnerable_time := 0.0
var shake_amount := 0.0

var obstacle_timer := 0.0
var coin_timer := 0.0
var passenger_timer := 0.0
var fuel_timer := 0.0

var braking := false
var brake_touch := false
var touch_start := Vector2.ZERO
var swipe_used := false

var obstacles: Array[Dictionary] = []
var coins: Array[Dictionary] = []
var passenger_stops: Array[Dictionary] = []
var fuel_pickups: Array[Dictionary] = []
var floaters: Array[Dictionary] = []

var left_button := Rect2(28, 842, 126, 92)
var brake_button := Rect2(181, 832, 178, 104)
var right_button := Rect2(386, 842, 126, 92)
var pause_button := Rect2(473, 18, 49, 49)
var primary_button := Rect2(100, 652, 340, 86)


func _ready() -> void:
	ui_font = ThemeDB.fallback_font
	rng.randomize()
	load_best_score()
	queue_redraw()


func _process(delta: float) -> void:
	if Input.is_action_just_pressed("pause_game"):
		toggle_pause()

	if game_state == GameState.PLAYING:
		if Input.is_action_just_pressed("move_left"):
			move_lane(-1)
		if Input.is_action_just_pressed("move_right"):
			move_lane(1)

		braking = brake_touch or Input.is_action_pressed("brake")
		update_game(delta)
	elif game_state != GameState.PAUSED:
		braking = false

	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			pointer_down(event.position)
		else:
			pointer_up(event.position)
	elif event is InputEventScreenDrag:
		pointer_drag(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			pointer_down(event.position)
		else:
			pointer_up(event.position)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		pointer_drag(event.position)


func pointer_down(position: Vector2) -> void:
	touch_start = position
	swipe_used = false

	if game_state == GameState.MENU:
		if primary_button.has_point(position):
			start_game()
		return

	if game_state == GameState.GAME_OVER:
		if primary_button.has_point(position):
			start_game()
		return

	if game_state == GameState.PAUSED:
		if primary_button.has_point(position):
			game_state = GameState.PLAYING
		return

	if game_state != GameState.PLAYING:
		return

	if pause_button.has_point(position):
		toggle_pause()
	elif left_button.has_point(position):
		move_lane(-1)
		swipe_used = true
	elif right_button.has_point(position):
		move_lane(1)
		swipe_used = true
	elif brake_button.has_point(position):
		brake_touch = true


func pointer_drag(position: Vector2) -> void:
	if game_state != GameState.PLAYING or swipe_used or brake_touch:
		return
	var horizontal := position.x - touch_start.x
	if abs(horizontal) > 52.0:
		move_lane(1 if horizontal > 0.0 else -1)
		swipe_used = true


func pointer_up(_position: Vector2) -> void:
	brake_touch = false
	braking = false


func move_lane(direction: int) -> void:
	if game_state != GameState.PLAYING:
		return
	lane_index = clampi(lane_index + direction, 0, 2)
	target_x = LANE_X[lane_index]


func toggle_pause() -> void:
	if game_state == GameState.PLAYING:
		game_state = GameState.PAUSED
		brake_touch = false
	elif game_state == GameState.PAUSED:
		game_state = GameState.PLAYING


func start_game() -> void:
	game_state = GameState.PLAYING
	lane_index = 1
	player_x = LANE_X[1]
	target_x = LANE_X[1]
	fuel = 100.0
	hearts = 3
	distance = 0.0
	fare = 0
	coins_collected = 0
	passengers = 0
	combo = 0
	score = 0
	world_speed = 315.0
	road_offset = 0.0
	scenery_offset = 0.0
	invulnerable_time = 0.0
	shake_amount = 0.0
	obstacle_timer = 0.9
	coin_timer = 0.35
	passenger_timer = 2.4
	fuel_timer = 9.0
	braking = false
	brake_touch = false
	obstacles.clear()
	coins.clear()
	passenger_stops.clear()
	fuel_pickups.clear()
	floaters.clear()


func update_game(delta: float) -> void:
	var difficulty := minf(distance / 1500.0, 1.0)
	var base_speed := 315.0 + difficulty * 175.0
	world_speed = base_speed * (0.58 if braking else 1.0)
	player_x = lerpf(player_x, target_x, 1.0 - exp(-delta * 14.0))
	road_offset = fmod(road_offset + world_speed * delta, 126.0)
	scenery_offset = fmod(scenery_offset + world_speed * 0.42 * delta, 210.0)
	distance += world_speed * delta / 13.0
	fuel = maxf(0.0, fuel - delta * (2.05 + difficulty * 0.8) * (0.72 if braking else 1.0))
	score = int(distance) + fare * 5 + coins_collected * 10
	invulnerable_time = maxf(0.0, invulnerable_time - delta)
	shake_amount = maxf(0.0, shake_amount - delta * 22.0)

	if fuel <= 0.0:
		end_game("Naubusan ng gasolina!")
		return

	obstacle_timer -= delta
	coin_timer -= delta
	passenger_timer -= delta
	fuel_timer -= delta

	if obstacle_timer <= 0.0:
		spawn_obstacle()
		obstacle_timer = rng.randf_range(1.05, 1.45) - difficulty * 0.24
	if coin_timer <= 0.0:
		spawn_coin_line()
		coin_timer = rng.randf_range(1.3, 2.1)
	if passenger_timer <= 0.0:
		spawn_passenger_stop()
		passenger_timer = rng.randf_range(4.0, 5.8)
	if fuel_timer <= 0.0:
		spawn_fuel()
		fuel_timer = rng.randf_range(10.5, 14.0)

	update_obstacles(delta)
	update_coins(delta)
	update_passenger_stops(delta)
	update_fuel_pickups(delta)
	update_floaters(delta)


func spawn_obstacle() -> void:
	var lane := rng.randi_range(0, 2)
	for obstacle in obstacles:
		if int(obstacle["lane"]) == lane and float(obstacle["y"]) < 115.0:
			lane = (lane + rng.randi_range(1, 2)) % 3
			break
	var kinds := ["car", "tricycle", "cone", "pothole"]
	var kind: String = kinds[rng.randi_range(0, kinds.size() - 1)]
	obstacles.append({
		"lane": lane,
		"y": -105.0,
		"kind": kind,
		"extra": rng.randf_range(-15.0, 55.0),
		"color": [Color("#ef476f"), Color("#7b61ff"), Color("#00b4d8")][rng.randi_range(0, 2)]
	})


func spawn_coin_line() -> void:
	var lane := rng.randi_range(0, 2)
	for i in range(3):
		coins.append({"lane": lane, "y": -40.0 - i * 56.0, "spin": rng.randf_range(0.0, TAU)})


func spawn_passenger_stop() -> void:
	passenger_stops.append({"lane": rng.randi_range(0, 2), "y": -125.0, "missed": false})


func spawn_fuel() -> void:
	fuel_pickups.append({"lane": rng.randi_range(0, 2), "y": -90.0})


func update_obstacles(delta: float) -> void:
	for i in range(obstacles.size() - 1, -1, -1):
		var obstacle := obstacles[i]
		obstacle["y"] = float(obstacle["y"]) + (world_speed + float(obstacle["extra"])) * delta
		obstacles[i] = obstacle

		if obstacle_rect(obstacle).intersects(player_rect()) and invulnerable_time <= 0.0:
			hearts -= 1
			combo = 0
			invulnerable_time = 1.35
			shake_amount = 11.0
			add_floater("BANG! -1 puso", player_x, PLAYER_Y - 86.0, RED)
			obstacles.remove_at(i)
			if hearts <= 0:
				end_game("Nasira ang jeepney!")
				return
		elif float(obstacle["y"]) > VIEW_H + 140.0:
			obstacles.remove_at(i)


func update_coins(delta: float) -> void:
	for i in range(coins.size() - 1, -1, -1):
		var coin := coins[i]
		coin["y"] = float(coin["y"]) + world_speed * delta
		coin["spin"] = float(coin["spin"]) + delta * 5.0
		coins[i] = coin
		var coin_rect := Rect2(LANE_X[int(coin["lane"])] - 24.0, float(coin["y"]) - 24.0, 48.0, 48.0)
		if coin_rect.intersects(player_rect()):
			coins_collected += 1
			fare += 1
			add_floater("+₱1", player_x, PLAYER_Y - 76.0, YELLOW)
			coins.remove_at(i)
		elif float(coin["y"]) > VIEW_H + 60.0:
			coins.remove_at(i)


func update_passenger_stops(delta: float) -> void:
	for i in range(passenger_stops.size() - 1, -1, -1):
		var stop := passenger_stops[i]
		stop["y"] = float(stop["y"]) + world_speed * delta
		passenger_stops[i] = stop
		var stop_rect := Rect2(LANE_X[int(stop["lane"])] - 45.0, float(stop["y"]) - 66.0, 90.0, 132.0)
		if stop_rect.intersects(player_rect()) and braking:
			combo += 1
			passengers += 1
			var earned := 12 + min(combo - 1, 5) * 2
			fare += earned
			add_floater("SAKAY! +₱%d" % earned, player_x, PLAYER_Y - 92.0, GREEN)
			passenger_stops.remove_at(i)
			if passengers >= 8:
				fare += 80
				passengers = 0
				add_floater("PUNO! +₱80", player_x, PLAYER_Y - 126.0, CYAN)
		elif float(stop["y"]) > PLAYER_Y + 120.0:
			combo = 0
			passenger_stops.remove_at(i)


func update_fuel_pickups(delta: float) -> void:
	for i in range(fuel_pickups.size() - 1, -1, -1):
		var pickup := fuel_pickups[i]
		pickup["y"] = float(pickup["y"]) + world_speed * delta
		fuel_pickups[i] = pickup
		var pickup_rect := Rect2(LANE_X[int(pickup["lane"])] - 30.0, float(pickup["y"]) - 38.0, 60.0, 76.0)
		if pickup_rect.intersects(player_rect()):
			fuel = minf(100.0, fuel + 28.0)
			add_floater("GAS +28", player_x, PLAYER_Y - 82.0, CYAN)
			fuel_pickups.remove_at(i)
		elif float(pickup["y"]) > VIEW_H + 90.0:
			fuel_pickups.remove_at(i)


func update_floaters(delta: float) -> void:
	for i in range(floaters.size() - 1, -1, -1):
		var floater := floaters[i]
		floater["y"] = float(floater["y"]) - 42.0 * delta
		floater["life"] = float(floater["life"]) - delta
		floaters[i] = floater
		if float(floater["life"]) <= 0.0:
			floaters.remove_at(i)


func player_rect() -> Rect2:
	return Rect2(player_x - 38.0, PLAYER_Y - 61.0, 76.0, 122.0)


func obstacle_rect(obstacle: Dictionary) -> Rect2:
	var x: float = LANE_X[int(obstacle["lane"])]
	var y: float = float(obstacle["y"])
	match String(obstacle["kind"]):
		"cone":
			return Rect2(x - 24.0, y - 30.0, 48.0, 60.0)
		"pothole":
			return Rect2(x - 42.0, y - 22.0, 84.0, 44.0)
		"tricycle":
			return Rect2(x - 40.0, y - 55.0, 80.0, 110.0)
		_:
			return Rect2(x - 38.0, y - 59.0, 76.0, 118.0)


func add_floater(text: String, x: float, y: float, color: Color) -> void:
	floaters.append({"text": text, "x": x, "y": y, "life": 1.05, "color": color})


func end_game(reason: String) -> void:
	if game_state != GameState.PLAYING:
		return
	game_state = GameState.GAME_OVER
	brake_touch = false
	braking = false
	add_floater(reason, VIEW_W * 0.5, PLAYER_Y - 120.0, RED)
	if score > best_score:
		best_score = score
		save_best_score()


func load_best_score() -> void:
	var config := ConfigFile.new()
	if config.load("user://jeepney_dash.cfg") == OK:
		best_score = int(config.get_value("scores", "best", 0))


func save_best_score() -> void:
	var config := ConfigFile.new()
	config.set_value("scores", "best", best_score)
	config.save("user://jeepney_dash.cfg")


func _draw() -> void:
	var shake := Vector2.ZERO
	if shake_amount > 0.0:
		shake = Vector2(rng.randf_range(-shake_amount, shake_amount), rng.randf_range(-shake_amount, shake_amount))
	draw_set_transform(shake)
	draw_world()
	draw_set_transform(Vector2.ZERO)
	draw_hud()

	if game_state == GameState.PLAYING:
		draw_controls()
	elif game_state == GameState.MENU:
		draw_menu()
	elif game_state == GameState.PAUSED:
		draw_pause_overlay()
	elif game_state == GameState.GAME_OVER:
		draw_game_over()


func draw_world() -> void:
	draw_rect(Rect2(0, 0, VIEW_W, VIEW_H), NAVY)
	draw_scenery()
	draw_road()

	for stop in passenger_stops:
		draw_passenger_stop(stop)
	for pickup in fuel_pickups:
		draw_fuel(pickup)
	for coin in coins:
		draw_coin(coin)
	for obstacle in obstacles:
		draw_obstacle(obstacle)

	if game_state != GameState.MENU or distance > 0.0:
		draw_jeepney()

	for floater in floaters:
		var alpha := clampf(float(floater["life"]), 0.0, 1.0)
		var color: Color = floater["color"]
		color.a = alpha
		draw_centered_text(String(floater["text"]), float(floater["y"]), 20, color)


func draw_scenery() -> void:
	draw_rect(Rect2(0, ROAD_TOP, ROAD_LEFT, VIEW_H - ROAD_TOP), Color("#173d4f"))
	draw_rect(Rect2(ROAD_RIGHT, ROAD_TOP, VIEW_W - ROAD_RIGHT, VIEW_H - ROAD_TOP), Color("#173d4f"))
	for i in range(7):
		var y := fmod(i * 168.0 + scenery_offset, 1176.0) - 168.0
		var warm := Color("#f9c74f") if i % 2 == 0 else Color("#90be6d")
		draw_rect(Rect2(5, y, 48, 116), Color("#26556c"))
		draw_rect(Rect2(13, y + 22, 13, 16), warm)
		draw_rect(Rect2(32, y + 22, 13, 16), warm)
		draw_rect(Rect2(487, y + 42, 48, 126), Color("#204960"))
		draw_rect(Rect2(495, y + 66, 13, 16), warm)
		draw_rect(Rect2(514, y + 66, 13, 16), warm)
		draw_circle(Vector2(30, y + 143), 18, Color("#44a36f"))
		draw_circle(Vector2(510, y + 18), 20, Color("#44a36f"))


func draw_road() -> void:
	draw_rect(Rect2(ROAD_LEFT, ROAD_TOP, ROAD_RIGHT - ROAD_LEFT, VIEW_H - ROAD_TOP), ROAD)
	draw_rect(Rect2(ROAD_LEFT, ROAD_TOP, 9, VIEW_H - ROAD_TOP), ROAD_EDGE)
	draw_rect(Rect2(ROAD_RIGHT - 9, ROAD_TOP, 9, VIEW_H - ROAD_TOP), ROAD_EDGE)
	for divider_x in [201.0, 339.0]:
		for i in range(10):
			var y := ROAD_TOP - 95.0 + i * 126.0 + road_offset
			draw_rect(Rect2(divider_x - 4.0, y, 8, 64), Color(1, 1, 1, 0.58))


func draw_obstacle(obstacle: Dictionary) -> void:
	var x: float = LANE_X[int(obstacle["lane"])]
	var y: float = float(obstacle["y"])
	var kind := String(obstacle["kind"])
	if kind == "pothole":
		draw_circle(Vector2(x, y), 40, Color("#111923"))
		draw_circle(Vector2(x - 9, y - 3), 20, Color("#1d2630"))
		return
	if kind == "cone":
		draw_colored_polygon(PackedVector2Array([Vector2(x, y - 34), Vector2(x - 27, y + 29), Vector2(x + 27, y + 29)]), ORANGE)
		draw_rect(Rect2(x - 31, y + 23, 62, 12), WHITE)
		return

	var body_color: Color = obstacle["color"]
	if kind == "tricycle":
		draw_rect(Rect2(x - 38, y - 50, 76, 101), Color("#161f2b"))
		draw_rect(Rect2(x - 31, y - 43, 62, 86), body_color)
		draw_rect(Rect2(x - 25, y - 35, 50, 31), CYAN)
		draw_circle(Vector2(x + 36, y + 30), 14, Color("#101722"))
		draw_circle(Vector2(x - 36, y + 30), 14, Color("#101722"))
	else:
		draw_rect(Rect2(x - 39, y - 59, 78, 118), Color("#101722"))
		draw_rect(Rect2(x - 34, y - 54, 68, 108), body_color)
		draw_rect(Rect2(x - 26, y - 36, 52, 35), Color("#8de1ff"))
		draw_rect(Rect2(x - 25, y + 26, 18, 9), Color("#fff1a8"))
		draw_rect(Rect2(x + 7, y + 26, 18, 9), Color("#fff1a8"))


func draw_coin(coin: Dictionary) -> void:
	var x: float = LANE_X[int(coin["lane"])]
	var y: float = float(coin["y"])
	var width_scale := 0.55 + abs(cos(float(coin["spin"]))) * 0.45
	draw_circle(Vector2(x, y), 23, Color("#9f6a13"))
	draw_circle(Vector2(x, y), 18 * width_scale, YELLOW)
	draw_text_at("₱", Vector2(x - 8, y + 8), 22, INK)


func draw_passenger_stop(stop: Dictionary) -> void:
	var lane: int = int(stop["lane"])
	var x: float = LANE_X[lane]
	var y: float = float(stop["y"])
	draw_rect(Rect2(x - 48, y - 69, 96, 138), Color(0.29, 0.83, 0.55, 0.22))
	draw_rect(Rect2(x - 43, y + 48, 86, 13), GREEN)
	var person_x := x + (27.0 if lane != 2 else -27.0)
	var label_x := x + (-20.0 if lane != 2 else 20.0)
	draw_text_at("STOP", Vector2(label_x - 14.0, y + 59), 10, WHITE)
	draw_circle(Vector2(person_x, y - 20), 11, Color("#f1b98f"))
	draw_rect(Rect2(person_x - 10, y - 8, 20, 37), Color("#e84a5f"))
	draw_rect(Rect2(person_x - 9, y + 29, 7, 21), INK)
	draw_rect(Rect2(person_x + 2, y + 29, 7, 21), INK)


func draw_fuel(pickup: Dictionary) -> void:
	var x: float = LANE_X[int(pickup["lane"])]
	var y: float = float(pickup["y"])
	draw_rect(Rect2(x - 27, y - 35, 54, 70), Color("#00a7c4"))
	draw_rect(Rect2(x - 14, y - 45, 28, 13), WHITE)
	draw_rect(Rect2(x - 7, y - 23, 14, 37), WHITE)
	draw_rect(Rect2(x - 18, y - 11, 36, 14), WHITE)


func draw_jeepney() -> void:
	var alpha := 1.0
	if invulnerable_time > 0.0 and int(invulnerable_time * 12.0) % 2 == 0:
		alpha = 0.42
	var body := YELLOW
	body.a = alpha
	var trim := ORANGE
	trim.a = alpha
	var glass := CYAN
	glass.a = alpha
	draw_rect(Rect2(player_x - 48, PLAYER_Y - 69, 96, 139), Color(0.02, 0.03, 0.05, 0.35))
	draw_rect(Rect2(player_x - 42, PLAYER_Y - 65, 84, 130), body)
	draw_rect(Rect2(player_x - 36, PLAYER_Y - 48, 72, 39), glass)
	draw_rect(Rect2(player_x - 4, PLAYER_Y - 48, 8, 39), WHITE)
	draw_rect(Rect2(player_x - 43, PLAYER_Y + 19, 86, 31), trim)
	draw_rect(Rect2(player_x - 29, PLAYER_Y + 26, 58, 18), Color("#d8324a"))
	draw_text_at("SAKAY", Vector2(player_x - 25, PLAYER_Y + 41), 13, WHITE)
	draw_rect(Rect2(player_x - 48, PLAYER_Y - 44, 8, 34), Color("#121a25"))
	draw_rect(Rect2(player_x + 40, PLAYER_Y - 44, 8, 34), Color("#121a25"))
	draw_rect(Rect2(player_x - 48, PLAYER_Y + 35, 8, 34), Color("#121a25"))
	draw_rect(Rect2(player_x + 40, PLAYER_Y + 35, 8, 34), Color("#121a25"))
	if braking:
		draw_rect(Rect2(player_x - 30, PLAYER_Y + 54, 19, 8), RED)
		draw_rect(Rect2(player_x + 11, PLAYER_Y + 54, 19, 8), RED)


func draw_hud() -> void:
	draw_rect(Rect2(0, 0, VIEW_W, 94), Color("#071426"))
	draw_text_at("SCORE", Vector2(18, 25), 13, Color("#8ca5bd"))
	draw_text_at(str(score).pad_zeros(6), Vector2(18, 53), 26, WHITE)
	draw_text_at("₱%d" % fare, Vector2(178, 52), 24, YELLOW)
	draw_text_at("🧍 %d/8" % passengers, Vector2(276, 51), 21, GREEN)
	for i in range(3):
		draw_text_at("♥" if i < hearts else "♡", Vector2(383 + i * 27, 52), 26, RED if i < hearts else Color("#637383"))
	draw_rect(Rect2(18, 72, 424, 10), Color("#233447"))
	draw_rect(Rect2(18, 72, 424 * fuel / 100.0, 10), GREEN if fuel > 28.0 else RED)
	draw_text_at("Ⅱ", Vector2(485, 52), 25, WHITE)


func draw_controls() -> void:
	var control_bg := Color(0.03, 0.08, 0.14, 0.82)
	draw_circle(left_button.get_center(), 55, control_bg)
	draw_circle(right_button.get_center(), 55, control_bg)
	draw_circle(brake_button.get_center(), 61, Color(0.87, 0.24, 0.3, 0.87) if braking else Color(0.08, 0.18, 0.26, 0.9))
	draw_centered_at("‹", left_button.get_center() + Vector2(0, 20), 54, WHITE)
	draw_centered_at("›", right_button.get_center() + Vector2(0, 20), 54, WHITE)
	draw_centered_at("PRENO", brake_button.get_center() + Vector2(0, 7), 19, WHITE)
	if combo > 1:
		draw_centered_text("SAKAY COMBO x%d" % combo, 126, 18, GREEN)


func draw_menu() -> void:
	draw_rect(Rect2(0, 0, VIEW_W, VIEW_H), Color(0.015, 0.035, 0.065, 0.76))
	draw_rect(Rect2(58, 140, 424, 616), Color("#0d2747"))
	draw_centered_text("JEEPNEY", 255, 56, YELLOW)
	draw_centered_text("DASH", 318, 70, WHITE)
	draw_centered_text("BYAHENG PINOY", 358, 18, CYAN)
	draw_centered_text("Iwas trapik • Sakay pasahero • Kulekta barya", 444, 17, Color("#c5d7e8"))
	draw_centered_text("Swipe o pindutin ang kaliwa at kanan", 492, 16, WHITE)
	draw_centered_text("Hold PRENO sa berdeng passenger stop", 524, 16, GREEN)
	draw_rect(primary_button, YELLOW)
	draw_centered_text("SIMULAN ANG BIYAHE", 707, 22, INK)
	draw_centered_text("Best score: %d" % best_score, 790, 17, Color("#9fb6ca"))


func draw_pause_overlay() -> void:
	draw_rect(Rect2(0, 0, VIEW_W, VIEW_H), Color(0.015, 0.035, 0.065, 0.82))
	draw_centered_text("NAKA-PAUSE", 390, 45, WHITE)
	draw_centered_text("Handa ka na bang bumiyahe ulit?", 446, 18, Color("#bdd0e1"))
	draw_rect(primary_button, YELLOW)
	draw_centered_text("IPAGPATULOY", 707, 23, INK)


func draw_game_over() -> void:
	draw_rect(Rect2(0, 0, VIEW_W, VIEW_H), Color(0.015, 0.035, 0.065, 0.82))
	draw_rect(Rect2(62, 220, 416, 540), Color("#0d2747"))
	draw_centered_text("TAPOS ANG BIYAHE", 310, 36, WHITE)
	draw_centered_text("SCORE", 378, 15, Color("#8ca5bd"))
	draw_centered_text(str(score), 440, 54, YELLOW)
	draw_centered_text("Distansya: %dm   Pamasahe: ₱%d" % [int(distance), fare], 497, 18, Color("#c5d7e8"))
	draw_centered_text("Best: %d" % best_score, 540, 19, CYAN)
	draw_rect(primary_button, YELLOW)
	draw_centered_text("BIYAHE ULIT", 707, 23, INK)


func draw_text_at(text: String, position: Vector2, size: int, color: Color) -> void:
	draw_string(ui_font, position, text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size, color)


func draw_centered_text(text: String, baseline_y: float, size: int, color: Color) -> void:
	var text_width := ui_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size).x
	draw_string(ui_font, Vector2((VIEW_W - text_width) * 0.5, baseline_y), text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size, color)


func draw_centered_at(text: String, position: Vector2, size: int, color: Color) -> void:
	var text_width := ui_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size).x
	draw_string(ui_font, Vector2(position.x - text_width * 0.5, position.y), text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size, color)
