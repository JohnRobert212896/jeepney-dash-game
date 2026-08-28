# Mini Game Design Document

## Product

**Title:** Jeepney Dash: Byaheng Pinoy  
**Genre:** 2D endless driving / arcade  
**Platform:** Android first; iOS and web compatible  
**Orientation:** Portrait, 9:16  
**Audience:** Casual players ages 7+  
**Session length:** 1–4 minutes

## Player fantasy

The player drives a cheerful, customized Filipino jeepney through lively local streets. A strong run balances speed, safety, passenger service, and resource management.

## Core loop

1. Steer between three lanes.
2. Avoid traffic and road hazards.
3. Collect coins and fuel.
4. Brake at marked passenger stops.
5. Build a passenger combo and beat the high score.
6. Spend future rewards on jeepney customization.

## MVP rules

- Fuel drains continuously and ends the run at zero.
- A collision removes one of three hearts.
- A passenger is collected only when the jeepney is in the same lane and the brake is held.
- Eight passengers complete a full-load bonus and reset the seats.
- Speed and obstacle frequency increase with distance.
- High score is saved locally.

## Accessibility and safety

- Controls are large and usable with one hand.
- Keyboard controls are included for desktop testing.
- Color is reinforced with icons, text, and shapes.
- Pedestrians remain in safe loading bays; the player never collides with them.
- The game rewards safe stops rather than reckless driving.

## Production roadmap

### Version 0.2

- Original sprite sheet and animation
- Barangay and palengke scenery sets
- Daily missions
- Garage with three jeepney colorways

### Version 0.3

- Provincial and city routes
- Weather variations
- Tutorial and accessibility settings
- Improved audio and haptic feedback

### Version 1.0

- Android release build
- Achievements and optional leaderboard
- Privacy policy and store assets
- Device testing and performance pass

