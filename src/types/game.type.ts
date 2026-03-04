import { User } from './user.type'

export type Game = {
	id: string
	name: string
	invite_code: string
	host: string
	max_players: number
	players: User[]
	max_rounds: number
	rounds: GameRound[]
	status: 'waiting' | 'in_progress' | 'finished'
	winner?: string
	created_at: Date
	updated_at: Date
}

export type GameCard = {
	id: string
	type: 'black' | 'white'
	text: string
	gap_count: number
}

export type GameRound = {
	id: string
	game_id: string
	number: number
	czar_id: string
	phase: 'picking_black' | 'picking_white' | 'judging' | 'complete'
	black_card: SelectedCard
	white_cards: SelectedCard[]
	winning_card: SelectedCard
}

export type SelectedCard = GameCard & {
	player_id: string
	player_name: string
}
